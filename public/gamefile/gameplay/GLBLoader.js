window.GLBLoader = class GLBLoader {
    constructor() {}
    
    async load(url) {
        const response = await fetch(url);
        const arrayBuffer = await response.arrayBuffer();
        this.parse(arrayBuffer);
    }

    parse(arrayBuffer) {
        const dataView = new DataView(arrayBuffer);
        let offset = 0;
        
        const magic = dataView.getUint32(offset, true); offset += 4;
        const version = dataView.getUint32(offset, true); offset += 4;
        const length = dataView.getUint32(offset, true); offset += 4;
        
        const jsonChunkLength = dataView.getUint32(offset, true); offset += 4;
        const jsonChunkType = dataView.getUint32(offset, true); offset += 4;
        
        const jsonString = new TextDecoder('utf-8').decode(new Uint8Array(arrayBuffer, offset, jsonChunkLength));
        this.json = JSON.parse(jsonString);
        offset += jsonChunkLength;
        
        const binChunkLength = dataView.getUint32(offset, true); offset += 4;
        const binChunkType = dataView.getUint32(offset, true); offset += 4;
        
        this.binBuffer = arrayBuffer.slice(offset, offset + binChunkLength);
        
        this._prepareData();
    }

    _prepareData() {
        // Resolve accessors
        this.accessors = this.json.accessors.map(acc => {
            const bv = this.json.bufferViews[acc.bufferView];
            const byteOffset = (acc.byteOffset || 0) + (bv.byteOffset || 0);
            
            let array;
            if (acc.componentType === 5126) { // FLOAT
                array = new Float32Array(this.binBuffer, byteOffset, acc.count * this._getComponentCount(acc.type));
            } else if (acc.componentType === 5123) { // UNSIGNED_SHORT
                array = new Uint16Array(this.binBuffer, byteOffset, acc.count * this._getComponentCount(acc.type));
            } else if (acc.componentType === 5125) { // UNSIGNED_INT
                array = new Uint32Array(this.binBuffer, byteOffset, acc.count * this._getComponentCount(acc.type));
            } else if (acc.componentType === 5121) { // UNSIGNED_BYTE
                array = new Uint8Array(this.binBuffer, byteOffset, acc.count * this._getComponentCount(acc.type));
            }
            return array;
        });

        // Images
        if (this.json.images && this.json.images.length > 0) {
            this.images = [];
            this.json.images.forEach(img => {
                const bv = this.json.bufferViews[img.bufferView];
                const slice = this.binBuffer.slice(bv.byteOffset, bv.byteOffset + bv.byteLength);
                const blob = new Blob([slice], { type: img.mimeType });
                const url = URL.createObjectURL(blob);
                const image = new Image();
                image.src = url;
                this.images.push(image);
            });
        }
        
        // Hierarchy
        this.nodes = this.json.nodes.map(n => ({
            name: n.name,
            translation: (n.translation || [0,0,0]).slice(),
            rotation: (n.rotation || [0,0,0,1]).slice(),
            scale: (n.scale || [1,1,1]).slice(),
            baseTranslation: (n.translation || [0,0,0]).slice(),
            baseRotation: (n.rotation || [0,0,0,1]).slice(),
            baseScale: (n.scale || [1,1,1]).slice(),
            children: n.children || [],
            matrix: new Float32Array(16),
            localMatrix: new Float32Array(16)
        }));

        this.blendCacheState = this.nodes.map(() => ({
            t: [0, 0, 0],
            r: [0, 0, 0, 1],
            s: [1, 1, 1]
        }));
        this.layerCacheState = this.nodes.map(() => ({
            t: [0, 0, 0],
            r: [0, 0, 0, 1],
            s: [1, 1, 1]
        }));
        this._tmpQ0 = [0, 0, 0, 0];
        this._tmpQ1 = [0, 0, 0, 0];

        this.nodes.forEach((n, i) => {
            n.children.forEach(c => {
                this.nodes[c].parent = i;
            });
        });
        
        this.rootNodes = [];
        this.nodes.forEach((n, i) => {
            if (n.parent === undefined) this.rootNodes.push(i);
        });

        // Setup Body Part Masks (Upper Body, Lower Body, Pelvis/Hips)
        this.upperBodyNodes = new Uint8Array(this.nodes.length);
        this.lowerBodyNodes = new Uint8Array(this.nodes.length);
        this.hipsNodeIndex = -1;

        const markDescendants = (idx, maskArray) => {
            maskArray[idx] = 1;
            const node = this.nodes[idx];
            if (node && node.children) {
                for (let c = 0; c < node.children.length; c++) {
                    markDescendants(node.children[c], maskArray);
                }
            }
        };

        this.nodes.forEach((n, i) => {
            const name = (n.name || "").toLowerCase();
            if (name === "hips" || name === "pelvis" || name.includes("hips")) {
                this.hipsNodeIndex = i;
            }
            if (name === "spine02" || name === "spine" || (name.startsWith("spine") && !name.includes("01"))) {
                markDescendants(i, this.upperBodyNodes);
            }
            if (name.includes("upleg") || name === "leftupleg" || name === "rightupleg") {
                markDescendants(i, this.lowerBodyNodes);
            }
        });

        // Heuristic keyword backup to guarantee 100% bone assignment
        this.nodes.forEach((n, i) => {
            const name = (n.name || "").toLowerCase();
            if (name === "hips" || name === "pelvis" || name.includes("hips")) return;
            if (name.includes("spine") || name.includes("neck") || name.includes("head") ||
                name.includes("shoulder") || name.includes("arm") || name.includes("hand")) {
                this.upperBodyNodes[i] = 1;
            } else if (name.includes("leg") || name.includes("foot") || name.includes("toe")) {
                this.lowerBodyNodes[i] = 1;
            }
        });

        // Animations
        if (this.json.animations) {
            this.animations = this.json.animations.map(anim => {
                return {
                    name: anim.name,
                    duration: this._calcDuration(anim),
                    channels: anim.channels.map(ch => {
                        const sampler = anim.samplers[ch.sampler];
                        return {
                            node: ch.target.node,
                            path: ch.target.path,
                            input: this.accessors[sampler.input],
                            output: this.accessors[sampler.output]
                        };
                    })
                };
            });
        }

        // Skin
        if (this.json.skins && this.json.skins.length > 0) {
            const skin = this.json.skins[0];
            this.skin = {
                joints: skin.joints,
                inverseBindMatrices: this.accessors[skin.inverseBindMatrices]
            };
            this.jointMatrices = new Float32Array(skin.joints.length * 16);
        }

        // Mesh
        const mesh = this.json.meshes[0];
        const prim = mesh.primitives[0];
        
        this.basePositions = this.accessors[prim.attributes.POSITION];
        this.baseNormals = this.accessors[prim.attributes.NORMAL];
        if(prim.attributes.COLOR_0) {
            this.baseColors = this.accessors[prim.attributes.COLOR_0];
        } else {
            this.baseColors = new Float32Array(this.basePositions.length);
            for(let i=0; i<this.baseColors.length; i++) this.baseColors[i] = 1.0;
        }
        
        if (prim.attributes.TEXCOORD_0 !== undefined) {
            this.baseTexCoords = this.accessors[prim.attributes.TEXCOORD_0];
        } else {
            this.baseTexCoords = new Float32Array((this.basePositions.length / 3) * 2);
        }
        
        this.joints = this.accessors[prim.attributes.JOINTS_0];
        this.weights = this.accessors[prim.attributes.WEIGHTS_0];
        this.indices = this.accessors[prim.indices];
        this.vertexCount = this.basePositions.length / 3;

        this.outPositions = new Float32Array(this.basePositions.length);
        this.outNormals = new Float32Array(this.baseNormals.length);

        // Precalculate vertex dominant bone index and body part group for inspector & diagnostics
        this.vertexDominantBones = new Int16Array(this.vertexCount);
        this.vertexPartGroups = new Uint8Array(this.vertexCount); // 0: head, 1: torso, 2: left_arm, 3: right_arm, 4: left_leg, 5: right_leg
        this.dominantBoneVertexCounts = {};

        const getPartGroupIndex = (boneName) => {
            const n = (boneName || "").toLowerCase();
            if (n.includes("head") || n.includes("neck")) return 0;
            if (n.includes("spine") || n.includes("hips") || n.includes("pelvis")) return 1;
            if (n.includes("left") && (n.includes("shoulder") || n.includes("arm") || n.includes("hand"))) return 2;
            if (n.includes("right") && (n.includes("shoulder") || n.includes("arm") || n.includes("hand"))) return 3;
            if (n.includes("left") && (n.includes("leg") || n.includes("foot") || n.includes("toe"))) return 4;
            if (n.includes("right") && (n.includes("leg") || n.includes("foot") || n.includes("toe"))) return 5;
            return 1;
        };

        if (this.joints && this.weights && this.skin) {
            for (let i = 0; i < this.vertexCount; i++) {
                let maxW = -1;
                let maxJ = 0;
                const i4 = i * 4;
                for (let j = 0; j < 4; j++) {
                    const w = this.weights[i4 + j];
                    if (w > maxW) {
                        maxW = w;
                        maxJ = this.joints[i4 + j];
                    }
                }
                const boneNodeIdx = this.skin.joints[maxJ];
                this.vertexDominantBones[i] = boneNodeIdx;
                this.dominantBoneVertexCounts[boneNodeIdx] = (this.dominantBoneVertexCounts[boneNodeIdx] || 0) + 1;
                const bName = this.nodes[boneNodeIdx] ? this.nodes[boneNodeIdx].name : "";
                this.vertexPartGroups[i] = getPartGroupIndex(bName);
            }
        }

        // Setup Virtual Bone for Ponytail Hair (แนวทางที่ 3: Virtual Bone Skinning)
        this._setupVirtualPonytailBone();
    }

    _invertMat4(out, a) {
        let a00 = a[0], a01 = a[1], a02 = a[2], a03 = a[3];
        let a10 = a[4], a11 = a[5], a12 = a[6], a13 = a[7];
        let a20 = a[8], a21 = a[9], a22 = a[10], a23 = a[11];
        let a30 = a[12], a31 = a[13], a32 = a[14], a33 = a[15];
        let b00 = a00 * a11 - a01 * a10, b01 = a00 * a12 - a02 * a10, b02 = a00 * a13 - a03 * a10;
        let b03 = a01 * a12 - a02 * a11, b04 = a01 * a13 - a03 * a11, b05 = a02 * a13 - a03 * a12;
        let b06 = a20 * a31 - a21 * a30, b07 = a20 * a32 - a22 * a30, b08 = a20 * a33 - a23 * a30;
        let b09 = a21 * a32 - a22 * a31, b10 = a21 * a33 - a23 * a31, b11 = a22 * a33 - a23 * a32;
        let det = b00 * b11 - b01 * b10 + b02 * b09 + b03 * b08 - b04 * b07 + b05 * b06;
        if (!det) return null;
        det = 1.0 / det;
        out[0] = (a11 * b11 - a12 * b10 + a13 * b09) * det;
        out[1] = (a02 * b10 - a01 * b11 - a03 * b09) * det;
        out[2] = (a31 * b05 - a32 * b04 + a33 * b03) * det;
        out[3] = (a22 * b04 - a21 * b05 - a23 * b03) * det;
        out[4] = (a12 * b08 - a10 * b11 - a13 * b07) * det;
        out[5] = (a00 * b11 - a02 * b08 + a03 * b07) * det;
        out[6] = (a32 * b02 - a30 * b05 - a33 * b01) * det;
        out[7] = (a20 * b05 - a22 * b02 + a23 * b01) * det;
        out[8] = (a10 * b10 - a11 * b08 + a13 * b06) * det;
        out[9] = (a01 * b08 - a00 * b10 - a03 * b06) * det;
        out[10] = (a30 * b04 - a31 * b02 + a33 * b00) * det;
        out[11] = (a21 * b02 - a20 * b04 - a23 * b00) * det;
        out[12] = (a11 * b07 - a10 * b09 - a12 * b06) * det;
        out[13] = (a00 * b09 - a01 * b07 + a02 * b06) * det;
        out[14] = (a31 * b01 - a30 * b03 - a32 * b00) * det;
        out[15] = (a20 * b03 - a21 * b01 + a22 * b00) * det;
        return out;
    }

    _setupVirtualPonytailBone() {
        if (!this.basePositions || !this.indices || !this.skin || !this.skin.joints) return;
        const vCount = this.vertexCount;
        const pos = this.basePositions;
        const ind = this.indices;

        // Disjoint-set union on triangles to find connected components
        const parent = new Int32Array(vCount);
        for (let i = 0; i < vCount; i++) parent[i] = i;
        function find(i) {
            let root = i;
            while (root !== parent[root]) root = parent[root];
            let cur = i;
            while (cur !== root) {
                const next = parent[cur];
                parent[cur] = root;
                cur = next;
            }
            return root;
        }
        function union(i, j) {
            const ri = find(i), rj = find(j);
            if (ri !== rj) parent[ri] = rj;
        }

        const indLen = ind.length;
        for (let i = 0; i < indLen; i += 3) {
            union(ind[i], ind[i + 1]);
            union(ind[i + 1], ind[i + 2]);
        }

        // Identify connected components belonging specifically to the hanging ponytail bunch (ช่อผมหางม้า 823 จุด)
        // Keeps the side of the head hair strictly attached to the head bone
        const ponytailRoots = new Set();
        for (let i = 0; i < vCount; i++) {
            const x = pos[i * 3], y = pos[i * 3 + 1], z = pos[i * 3 + 2];
            if (x > 0.05 && y > 0.80 && y < 0.95 && z < -0.10) {
                ponytailRoots.add(find(i));
            }
        }

        if (ponytailRoots.size === 0) return;

        // Find root (highest Y) and tip (lowest Y) of the full ponytail
        let rootY = -Infinity;
        let tipY = Infinity;
        let rootVertexIdx = 0;
        for (let i = 0; i < vCount; i++) {
            if (ponytailRoots.has(find(i))) {
                const y = pos[i * 3 + 1];
                if (y > rootY) {
                    rootY = y;
                    rootVertexIdx = i;
                }
                if (y < tipY) {
                    tipY = y;
                }
            }
        }
        const heightSpan = Math.max(0.01, rootY - tipY);

        const ponytailIndices = [];
        const ponytailWeights = new Float32Array(vCount);

        for (let i = 0; i < vCount; i++) {
            if (ponytailRoots.has(find(i))) {
                ponytailIndices.push(i);
                this.vertexPartGroups[i] = 6; // Hair
                const y = pos[i * 3 + 1];
                let t = (rootY - y) / heightSpan;
                if (t < 0) t = 0;
                if (t > 1) t = 1;
                // Smooth progressive bending curve: root follows head tightly, tip swings with virtual bone
                ponytailWeights[i] = t * t * (3 - 2 * t);
            }
        }

        this.ponytailIndices = new Int32Array(ponytailIndices);
        this.ponytailWeights = ponytailWeights;
        this.ponytailRootVertex = rootVertexIdx;

        // Find Head Node and Head Joint in the loaded skeleton
        const headNodeIdx = this.nodes.findIndex(n => n && n.name && n.name.toLowerCase() === "head");
        if (headNodeIdx === -1) return;
        const headJointIdx = this.skin.joints.indexOf(headNodeIdx);
        if (headJointIdx === -1) return;

        // Compute root vertex local position in Head coordinate space
        const headInvBind = this.skin.inverseBindMatrices.subarray(headJointIdx * 16, headJointIdx * 16 + 16);
        const px = pos[rootVertexIdx * 3];
        const py = pos[rootVertexIdx * 3 + 1];
        const pz = pos[rootVertexIdx * 3 + 2];

        const localX = headInvBind[0]*px + headInvBind[4]*py + headInvBind[8]*pz + headInvBind[12];
        const localY = headInvBind[1]*px + headInvBind[5]*py + headInvBind[9]*pz + headInvBind[13];
        const localZ = headInvBind[2]*px + headInvBind[6]*py + headInvBind[10]*pz + headInvBind[14];

        // 1. Create Virtual Bone Node in memory as child of Head
        const virtualNodeIdx = this.nodes.length;
        const virtualNode = {
            name: "Virtual_Ponytail",
            translation: [localX, localY, localZ],
            rotation: [0, 0, 0, 1],
            scale: [1, 1, 1],
            baseTranslation: [localX, localY, localZ],
            baseRotation: [0, 0, 0, 1],
            baseScale: [1, 1, 1],
            children: [],
            parent: headNodeIdx,
            matrix: new Float32Array(16),
            localMatrix: new Float32Array(16)
        };
        this.nodes.push(virtualNode);
        this.nodes[headNodeIdx].children.push(virtualNodeIdx);

        // Update animation layer & blending cache arrays
        this.blendCacheState.push({ t: [0, 0, 0], r: [0, 0, 0, 1], s: [1, 1, 1] });
        this.layerCacheState.push({ t: [0, 0, 0], r: [0, 0, 0, 1], s: [1, 1, 1] });
        if (this.upperBodyNodes) {
            const newUpper = new Uint8Array(this.nodes.length);
            newUpper.set(this.upperBodyNodes);
            newUpper[virtualNodeIdx] = 1;
            this.upperBodyNodes = newUpper;
        }
        if (this.lowerBodyNodes) {
            const newLower = new Uint8Array(this.nodes.length);
            newLower.set(this.lowerBodyNodes);
            this.lowerBodyNodes = newLower;
        }

        // 2. Compute Virtual Bone inverseBindMatrix
        const headBindWorld = new Float32Array(16);
        this._invertMat4(headBindWorld, headInvBind);

        const virtualLocalBind = new Float32Array([
            1, 0, 0, 0,
            0, 1, 0, 0,
            0, 0, 1, 0,
            localX, localY, localZ, 1
        ]);
        const virtualWorldBind = new Float32Array(16);
        this._multiplyMat4(virtualWorldBind, headBindWorld, virtualLocalBind);

        const virtualInvBind = new Float32Array(16);
        this._invertMat4(virtualInvBind, virtualWorldBind);

        // 3. Register Virtual Bone into skin.joints and skin.inverseBindMatrices
        const virtualJointIdx = this.skin.joints.length;
        this.skin.joints = [...this.skin.joints, virtualNodeIdx];

        const newInvBind = new Float32Array(this.skin.joints.length * 16);
        newInvBind.set(this.skin.inverseBindMatrices);
        newInvBind.set(virtualInvBind, virtualJointIdx * 16);
        this.skin.inverseBindMatrices = newInvBind;

        this.jointMatrices = new Float32Array(this.skin.joints.length * 16);

        // 4. Re-weight ponytail vertices to blend between Head and Virtual Bone
        this.joints = new Uint8Array(this.joints);
        this.weights = new Float32Array(this.weights);

        const pLen = ponytailIndices.length;
        for (let k = 0; k < pLen; k++) {
            const vi = ponytailIndices[k];
            const wi = ponytailWeights[vi];
            const i4 = vi * 4;

            // Slot 0 was Head with weight ~1.0. Re-route weight into Virtual Bone at slot 2:
            const origHeadW = this.weights[i4];
            this.joints[i4 + 2] = virtualJointIdx;
            this.weights[i4] = origHeadW * (1.0 - wi);
            this.weights[i4 + 2] = origHeadW * wi;

            // Update dominant bone count for Dev Inspector
            if (wi >= 0.5) {
                this.vertexDominantBones[vi] = virtualNodeIdx;
                this.dominantBoneVertexCounts[virtualNodeIdx] = (this.dominantBoneVertexCounts[virtualNodeIdx] || 0) + 1;
                if (this.dominantBoneVertexCounts[headNodeIdx]) {
                    this.dominantBoneVertexCounts[headNodeIdx]--;
                }
            }
        }

        this.virtualPonytailNodeIdx = virtualNodeIdx;
        this.virtualPonytailJointIdx = virtualJointIdx;
        this.virtualPonytailRotation = [0, 0, 0, 1];
    }

    setPonytailRotation(qx, qy, qz, qw) {
        if (Array.isArray(qx) || (qx && typeof qx[0] === "number")) {
            this.virtualPonytailRotation[0] = qx[0];
            this.virtualPonytailRotation[1] = qx[1];
            this.virtualPonytailRotation[2] = qx[2];
            this.virtualPonytailRotation[3] = qx[3];
        } else {
            this.virtualPonytailRotation[0] = qx || 0;
            this.virtualPonytailRotation[1] = qy || 0;
            this.virtualPonytailRotation[2] = qz || 0;
            this.virtualPonytailRotation[3] = (qw !== undefined) ? qw : 1;
        }
    }

    getBonesInfo() {
        if (!this.skin || !this.skin.joints) return [];
        return this.skin.joints.map((nodeIdx, jIdx) => {
            const node = this.nodes[nodeIdx] || {};
            const parentNode = (node.parent !== undefined) ? this.nodes[node.parent] : null;
            const isArmatureParent = parentNode && parentNode.name === "Armature";
            const effectiveParent = isArmatureParent ? null : parentNode;
            
            const bName = node.name || ("Bone_" + jIdx);
            const n = bName.toLowerCase();
            let part = "torso";
            let partColor = "#00b0ff";
            let partTh = "ลำตัว (Torso)";
            if (n.includes("virtual_ponytail") || n.includes("ponytail") || n.includes("hair")) {
                part = "hair";
                partColor = "#e040fb";
                partTh = "ผมรวบ (Virtual Ponytail)";
            } else if (n.includes("head") || n.includes("neck")) {
                part = "head";
                partColor = "#ff6e40";
                partTh = "ศีรษะ (Head)";
            } else if (n.includes("left") && (n.includes("shoulder") || n.includes("arm") || n.includes("hand"))) {
                part = "left_arm";
                partColor = "#00e676";
                partTh = "แขนซ้าย (Left Arm)";
            } else if (n.includes("right") && (n.includes("shoulder") || n.includes("arm") || n.includes("hand"))) {
                part = "right_arm";
                partColor = "#ffab00";
                partTh = "แขนขวา (Right Arm)";
            } else if (n.includes("left") && (n.includes("leg") || n.includes("foot") || n.includes("toe"))) {
                part = "left_leg";
                partColor = "#d500f9";
                partTh = "ขาซ้าย (Left Leg)";
            } else if (n.includes("right") && (n.includes("leg") || n.includes("foot") || n.includes("toe"))) {
                part = "right_leg";
                partColor = "#ff1744";
                partTh = "ขาขวา (Right Leg)";
            }

            return {
                jointIndex: jIdx,
                nodeIndex: nodeIdx,
                name: bName,
                parentName: effectiveParent ? effectiveParent.name : null,
                parentNodeIndex: effectiveParent ? node.parent : null,
                childCount: (node.children || []).length,
                childNames: (node.children || []).map(cIdx => this.nodes[cIdx] ? this.nodes[cIdx].name : "").filter(Boolean),
                dominantVertexCount: this.dominantBoneVertexCounts[nodeIdx] || 0,
                part: part,
                partTh: partTh,
                partColor: partColor,
                translation: node.translation ? Array.from(node.translation) : [0, 0, 0],
                rotation: node.rotation ? Array.from(node.rotation) : [0, 0, 0, 1],
                scale: node.scale ? Array.from(node.scale) : [1, 1, 1],
                matrixPos: node.matrix ? [node.matrix[12], node.matrix[13], node.matrix[14]] : [0, 0, 0]
            };
        });
    }

    getPartsSummary() {
        const parts = [
            { id: "head", nameTh: "ศีรษะ (Head)", color: "#ff6e40", rgb: [1.0, 0.43, 0.25], count: 0 },
            { id: "torso", nameTh: "ลำตัว (Torso)", color: "#00b0ff", rgb: [0.0, 0.69, 1.0], count: 0 },
            { id: "left_arm", nameTh: "แขนซ้าย (Left Arm)", color: "#00e676", rgb: [0.0, 0.90, 0.46], count: 0 },
            { id: "right_arm", nameTh: "แขนขวา (Right Arm)", color: "#ffab00", rgb: [1.0, 0.67, 0.0], count: 0 },
            { id: "left_leg", nameTh: "ขาซ้าย (Left Leg)", color: "#d500f9", rgb: [0.83, 0.0, 0.98], count: 0 },
            { id: "right_leg", nameTh: "ขาขวา (Right Leg)", color: "#ff1744", rgb: [1.0, 0.09, 0.27], count: 0 },
            { id: "hair", nameTh: "ผมรวบ (Ponytail Hair)", color: "#e040fb", rgb: [0.88, 0.25, 0.98], count: 0 }
        ];

        if (this.vertexPartGroups) {
            for (let i = 0; i < this.vertexCount; i++) {
                const g = this.vertexPartGroups[i];
                if (parts[g]) parts[g].count++;
            }
        }
        return parts.map(p => ({
            ...p,
            percent: ((p.count / (this.vertexCount || 1)) * 100).toFixed(1) + "%"
        }));
    }

    _getComponentCount(type) {
        if (type === 'SCALAR') return 1;
        if (type === 'VEC2') return 2;
        if (type === 'VEC3') return 3;
        if (type === 'VEC4') return 4;
        if (type === 'MAT4') return 16;
        return 1;
    }

    _calcDuration(anim) {
        let maxT = 0;
        anim.samplers.forEach(s => {
            const input = this.accessors[s.input];
            if (input[input.length-1] > maxT) maxT = input[input.length-1];
        });
        return maxT;
    }

    getAnimation(name) {
        if (!this.animations) return null;
        return this.animations.find(a => a.name === name) || this.animations[0];
    }

    _slerp(out, a, b, t) {
        let ax = a[0], ay = a[1], az = a[2], aw = a[3];
        let bx = b[0], by = b[1], bz = b[2], bw = b[3];
        let omega, cosom, sinom, scale0, scale1;

        cosom = ax * bx + ay * by + az * bz + aw * bw;
        if (cosom < 0.0) {
            cosom = -cosom;
            bx = -bx; by = -by; bz = -bz; bw = -bw;
        }
        if ((1.0 - cosom) > 0.000001) {
            omega = Math.acos(cosom);
            sinom = Math.sin(omega);
            scale0 = Math.sin((1.0 - t) * omega) / sinom;
            scale1 = Math.sin(t * omega) / sinom;
        } else {
            scale0 = 1.0 - t;
            scale1 = t;
        }
        out[0] = scale0 * ax + scale1 * bx;
        out[1] = scale0 * ay + scale1 * by;
        out[2] = scale0 * az + scale1 * bz;
        out[3] = scale0 * aw + scale1 * bw;
    }

    _lerpVec3(out, a, b, t, aOff=0, bOff=0) {
        out[0] = a[aOff] + (b[bOff] - a[aOff]) * t;
        out[1] = a[aOff+1] + (b[bOff+1] - a[aOff+1]) * t;
        out[2] = a[aOff+2] + (b[bOff+2] - a[aOff+2]) * t;
    }

    _fromRTS(out, q, v, s) {
        let x = q[0], y = q[1], z = q[2], w = q[3];
        let x2 = x + x, y2 = y + y, z2 = z + z;
        let xx = x * x2, xy = x * y2, xz = x * z2;
        let yy = y * y2, yz = y * z2, zz = z * z2;
        let wx = w * x2, wy = w * y2, wz = w * z2;
        let sx = s[0], sy = s[1], sz = s[2];
        out[0] = (1 - (yy + zz)) * sx; out[1] = (xy + wz) * sx; out[2] = (xz - wy) * sx; out[3] = 0;
        out[4] = (xy - wz) * sy; out[5] = (1 - (xx + zz)) * sy; out[6] = (yz + wx) * sy; out[7] = 0;
        out[8] = (xz + wy) * sz; out[9] = (yz - wx) * sz; out[10] = (1 - (xx + yy)) * sz; out[11] = 0;
        out[12] = v[0]; out[13] = v[1]; out[14] = v[2]; out[15] = 1;
    }

    _multiplyMat4(out, a, b) {
        let a00 = a[0], a01 = a[1], a02 = a[2], a03 = a[3];
        let a10 = a[4], a11 = a[5], a12 = a[6], a13 = a[7];
        let a20 = a[8], a21 = a[9], a22 = a[10], a23 = a[11];
        let a30 = a[12], a31 = a[13], a32 = a[14], a33 = a[15];
        let b00 = b[0], b01 = b[1], b02 = b[2], b03 = b[3];
        let b10 = b[4], b11 = b[5], b12 = b[6], b13 = b[7];
        let b20 = b[8], b21 = b[9], b22 = b[10], b23 = b[11];
        let b30 = b[12], b31 = b[13], b32 = b[14], b33 = b[15];
        out[0] = b00*a00 + b01*a10 + b02*a20 + b03*a30;
        out[1] = b00*a01 + b01*a11 + b02*a21 + b03*a31;
        out[2] = b00*a02 + b01*a12 + b02*a22 + b03*a32;
        out[3] = b00*a03 + b01*a13 + b02*a23 + b03*a33;
        out[4] = b10*a00 + b11*a10 + b12*a20 + b13*a30;
        out[5] = b10*a01 + b11*a11 + b12*a21 + b13*a31;
        out[6] = b10*a02 + b11*a12 + b12*a22 + b13*a32;
        out[7] = b10*a03 + b11*a13 + b12*a23 + b13*a33;
        out[8] = b20*a00 + b21*a10 + b22*a20 + b23*a30;
        out[9] = b20*a01 + b21*a11 + b22*a21 + b23*a31;
        out[10] = b20*a02 + b21*a12 + b22*a22 + b23*a32;
        out[11] = b20*a03 + b21*a13 + b22*a23 + b23*a33;
        out[12] = b30*a00 + b31*a10 + b32*a20 + b33*a30;
        out[13] = b30*a01 + b31*a11 + b32*a21 + b33*a31;
        out[14] = b30*a02 + b31*a12 + b32*a22 + b33*a32;
        out[15] = b30*a03 + b31*a13 + b32*a23 + b33*a33;
    }

    _updateHierarchy(nodeIdx, parentMatrix) {
        const n = this.nodes[nodeIdx];
        this._fromRTS(n.localMatrix, n.rotation, n.translation, n.scale);
        if (parentMatrix) {
            this._multiplyMat4(n.matrix, parentMatrix, n.localMatrix);
        } else {
            for(let i=0;i<16;i++) n.matrix[i] = n.localMatrix[i];
        }
        for (let i = 0; i < n.children.length; i++) {
            this._updateHierarchy(n.children[i], n.matrix);
        }
    }

    _resetNodeTransforms() {
        const nodes = this.nodes;
        const len = nodes.length;
        for (let i = 0; i < len; i++) {
            const n = nodes[i];
            const bt = n.baseTranslation;
            n.translation[0] = bt[0]; n.translation[1] = bt[1]; n.translation[2] = bt[2];
            const br = n.baseRotation;
            n.rotation[0] = br[0]; n.rotation[1] = br[1]; n.rotation[2] = br[2]; n.rotation[3] = br[3];
            const bs = n.baseScale;
            n.scale[0] = bs[0]; n.scale[1] = bs[1]; n.scale[2] = bs[2];
        }
    }

    _sampleAnimation(anim, time, loop) {
        let t = time;
        if (loop && anim.duration > 0) t = t % anim.duration;
        if (t < 0) t += anim.duration;

        const channels = anim.channels;
        const numChannels = channels.length;
        const q0 = this._tmpQ0;
        const q1 = this._tmpQ1;

        for (let c = 0; c < numChannels; c++) {
            const ch = channels[c];
            const times = ch.input;
            const values = ch.output;
            let frame = 0;
            const len1 = times.length - 1;
            while (frame < len1 && times[frame + 1] <= t) frame++;

            const n = this.nodes[ch.node];
            if (frame >= len1) {
                if (loop && anim.duration > times[frame]) {
                    const t0 = times[frame];
                    const t1 = anim.duration;
                    const f = (t - t0) / (t1 - t0);
                    if (ch.path === 'translation') {
                        this._lerpVec3(n.translation, values, values, f, frame * 3, 0);
                    } else if (ch.path === 'rotation') {
                        const f4 = frame * 4;
                        q0[0] = values[f4]; q0[1] = values[f4 + 1]; q0[2] = values[f4 + 2]; q0[3] = values[f4 + 3];
                        q1[0] = values[0]; q1[1] = values[1]; q1[2] = values[2]; q1[3] = values[3];
                        this._slerp(n.rotation, q0, q1, f);
                    } else if (ch.path === 'scale') {
                        this._lerpVec3(n.scale, values, values, f, frame * 3, 0);
                    }
                } else {
                    if (ch.path === 'translation') {
                        const f3 = frame * 3;
                        n.translation[0] = values[f3]; n.translation[1] = values[f3 + 1]; n.translation[2] = values[f3 + 2];
                    } else if (ch.path === 'rotation') {
                        const f4 = frame * 4;
                        n.rotation[0] = values[f4]; n.rotation[1] = values[f4 + 1]; n.rotation[2] = values[f4 + 2]; n.rotation[3] = values[f4 + 3];
                    } else if (ch.path === 'scale') {
                        const f3 = frame * 3;
                        n.scale[0] = values[f3]; n.scale[1] = values[f3 + 1]; n.scale[2] = values[f3 + 2];
                    }
                }
            } else {
                const t0 = times[frame];
                const t1 = times[frame + 1];
                const factor = (t - t0) / (t1 - t0);
                if (ch.path === 'translation') {
                    this._lerpVec3(n.translation, values, values, factor, frame * 3, (frame + 1) * 3);
                } else if (ch.path === 'rotation') {
                    const f4 = frame * 4;
                    const next4 = (frame + 1) * 4;
                    q0[0] = values[f4]; q0[1] = values[f4 + 1]; q0[2] = values[f4 + 2]; q0[3] = values[f4 + 3];
                    q1[0] = values[next4]; q1[1] = values[next4 + 1]; q1[2] = values[next4 + 2]; q1[3] = values[next4 + 3];
                    this._slerp(n.rotation, q0, q1, factor);
                } else if (ch.path === 'scale') {
                    this._lerpVec3(n.scale, values, values, factor, frame * 3, (frame + 1) * 3);
                }
            }
        }
    }

    _applySkinningAndFinalize() {
        // Apply Virtual Ponytail rotation before hierarchy update
        if (this.virtualPonytailNodeIdx !== undefined && this.nodes[this.virtualPonytailNodeIdx]) {
            const vn = this.nodes[this.virtualPonytailNodeIdx];
            vn.rotation[0] = this.virtualPonytailRotation[0];
            vn.rotation[1] = this.virtualPonytailRotation[1];
            vn.rotation[2] = this.virtualPonytailRotation[2];
            vn.rotation[3] = this.virtualPonytailRotation[3];
        }

        // Update hierarchy
        const rootNodes = this.rootNodes;
        for (let i = 0; i < rootNodes.length; i++) {
            this._updateHierarchy(rootNodes[i], null);
        }

        // Compute joint matrices
        if (this.skin) {
            const joints = this.skin.joints;
            const invBindMats = this.skin.inverseBindMatrices;
            const jointMats = this.jointMatrices;
            const nodes = this.nodes;
            const jLen = joints.length;

            for (let i = 0; i < jLen; i++) {
                const jointNodeIdx = joints[i];
                const invBindOffset = i * 16;
                const invBind = invBindMats.subarray(invBindOffset, invBindOffset + 16);
                const jointMat = jointMats.subarray(invBindOffset, invBindOffset + 16);
                this._multiplyMat4(jointMat, nodes[jointNodeIdx].matrix, invBind);
            }
        }

        // Apply skinning
        const bp = this.basePositions;
        const bn = this.baseNormals;
        const op = this.outPositions;
        const on = this.outNormals;
        const jts = this.joints;
        const wts = this.weights;
        const jm = this.jointMatrices;
        const vCount = this.vertexCount;

        for (let i = 0; i < vCount; i++) {
            const i3 = i * 3;
            const i4 = i * 4;

            let px = 0, py = 0, pz = 0;
            let nx = 0, ny = 0, nz = 0;

            const bx = bp[i3], by = bp[i3 + 1], bz = bp[i3 + 2];
            const bnx = bn[i3], bny = bn[i3 + 1], bnz = bn[i3 + 2];

            for (let j = 0; j < 4; j++) {
                const weight = wts[i4 + j];
                if (weight > 0.0) {
                    const jointIdx = jts[i4 + j] * 16;

                    const m00 = jm[jointIdx], m01 = jm[jointIdx + 4], m02 = jm[jointIdx + 8], m03 = jm[jointIdx + 12];
                    const m10 = jm[jointIdx + 1], m11 = jm[jointIdx + 5], m12 = jm[jointIdx + 9], m13 = jm[jointIdx + 13];
                    const m20 = jm[jointIdx + 2], m21 = jm[jointIdx + 6], m22 = jm[jointIdx + 10], m23 = jm[jointIdx + 14];

                    px += weight * (m00 * bx + m01 * by + m02 * bz + m03);
                    py += weight * (m10 * bx + m11 * by + m12 * bz + m13);
                    pz += weight * (m20 * bx + m21 * by + m22 * bz + m23);

                    nx += weight * (m00 * bnx + m01 * bny + m02 * bnz);
                    ny += weight * (m10 * bnx + m11 * bny + m12 * bnz);
                    nz += weight * (m20 * bnx + m21 * bny + m22 * bnz);
                }
            }

            op[i3] = px; op[i3 + 1] = py; op[i3 + 2] = pz;

            const nlen = Math.sqrt(nx * nx + ny * ny + nz * nz);
            if (nlen > 0.00001) {
                on[i3] = nx / nlen;
                on[i3 + 1] = ny / nlen;
                on[i3 + 2] = nz / nlen;
            } else {
                on[i3] = bnx; on[i3 + 1] = bny; on[i3 + 2] = bnz;
            }
        }

        return {
            positions: this.outPositions,
            normals: this.outNormals,
            colors: this.baseColors,
            texcoords: this.baseTexCoords,
            indices: this.indices
        };
    }

    getSkinnedMeshBlended(animName1, time1, animName2, time2, factor, loop = true) {
        if (factor <= 0.0) return this.getSkinnedMesh(animName1, time1, loop);
        if (factor >= 1.0) return this.getSkinnedMesh(animName2, time2, loop);

        // 1. Reset and sample Animation 1
        this._resetNodeTransforms();
        if (this.animations && this.animations.length > 0) {
            const anim1 = this.getAnimation(animName1);
            if (anim1) this._sampleAnimation(anim1, time1, loop);
        }

        // Save Anim1 state into preallocated cache
        const cache = this.blendCacheState;
        const nodes = this.nodes;
        const nLen = nodes.length;
        for (let i = 0; i < nLen; i++) {
            const n = nodes[i];
            const c = cache[i];
            c.t[0] = n.translation[0]; c.t[1] = n.translation[1]; c.t[2] = n.translation[2];
            c.r[0] = n.rotation[0]; c.r[1] = n.rotation[1]; c.r[2] = n.rotation[2]; c.r[3] = n.rotation[3];
            c.s[0] = n.scale[0]; c.s[1] = n.scale[1]; c.s[2] = n.scale[2];
        }

        // 2. Reset and sample Animation 2
        this._resetNodeTransforms();
        if (this.animations && this.animations.length > 0) {
            const anim2 = this.getAnimation(animName2);
            if (anim2) this._sampleAnimation(anim2, time2, loop);
        }

        // 3. Blend Anim1 and Anim2
        for (let i = 0; i < nLen; i++) {
            const n = nodes[i];
            const s1 = cache[i];

            n.translation[0] = s1.t[0] + (n.translation[0] - s1.t[0]) * factor;
            n.translation[1] = s1.t[1] + (n.translation[1] - s1.t[1]) * factor;
            n.translation[2] = s1.t[2] + (n.translation[2] - s1.t[2]) * factor;

            n.scale[0] = s1.s[0] + (n.scale[0] - s1.s[0]) * factor;
            n.scale[1] = s1.s[1] + (n.scale[1] - s1.s[1]) * factor;
            n.scale[2] = s1.s[2] + (n.scale[2] - s1.s[2]) * factor;

            this._slerp(n.rotation, s1.r, n.rotation, factor);
        }

        return this._applySkinningAndFinalize();
    }

    getSkinnedMesh(animName, time, loop = true) {
        this._resetNodeTransforms();

        if (this.animations && this.animations.length > 0) {
            const anim = this.getAnimation(animName);
            if (anim) this._sampleAnimation(anim, time, loop);
        }

        return this._applySkinningAndFinalize();
    }

    isUpperBodyNode(nodeIdx) {
        return !!(this.upperBodyNodes && this.upperBodyNodes[nodeIdx]);
    }

    isLowerBodyNode(nodeIdx) {
        return !!(this.lowerBodyNodes && this.lowerBodyNodes[nodeIdx]);
    }

    /**
     * Layered animation mixing between lower body (legs, locomotion, hips)
     * and upper body (spine, arms, hands, neck, head).
     *
     * @param {string} lowerAnimName - Animation name for lower body / locomotion
     * @param {number} lowerTime - Playback time for lower body animation
     * @param {string} upperAnimName - Animation name for upper body / action
     * @param {number} upperTime - Playback time for upper body animation
     * @param {number} upperWeight - Blend weight for upper body (0.0 = 100% lower, 1.0 = 100% upper on upper bones)
     * @param {boolean} loop - Whether to loop
     * @param {number} hipsBlend - Blend weight for hips rotation/position (0.0 = hips follow lowerAnim, 1.0 = hips follow upperAnim)
     */
    getSkinnedMeshLayered(lowerAnimName, lowerTime, upperAnimName, upperTime, upperWeight = 1.0, loop = true, hipsBlend = 0.0) {
        if (upperWeight <= 0.001 || !upperAnimName) {
            return this.getSkinnedMesh(lowerAnimName, lowerTime, loop);
        }
        if (upperWeight >= 0.999 && (!lowerAnimName || lowerAnimName === upperAnimName)) {
            return this.getSkinnedMesh(upperAnimName, upperTime, loop);
        }

        const nodes = this.nodes;
        const nLen = nodes.length;

        // 1. Reset and sample lower body animation into layerCacheState
        this._resetNodeTransforms();
        if (this.animations && this.animations.length > 0) {
            const lowerAnim = this.getAnimation(lowerAnimName);
            if (lowerAnim) this._sampleAnimation(lowerAnim, lowerTime, loop);
        }
        const lowerCache = this.layerCacheState;
        for (let i = 0; i < nLen; i++) {
            const n = nodes[i];
            const c = lowerCache[i];
            c.t[0] = n.translation[0]; c.t[1] = n.translation[1]; c.t[2] = n.translation[2];
            c.r[0] = n.rotation[0]; c.r[1] = n.rotation[1]; c.r[2] = n.rotation[2]; c.r[3] = n.rotation[3];
            c.s[0] = n.scale[0]; c.s[1] = n.scale[1]; c.s[2] = n.scale[2];
        }

        // 2. Reset and sample upper body action animation into nodes
        this._resetNodeTransforms();
        if (this.animations && this.animations.length > 0) {
            const upperAnim = this.getAnimation(upperAnimName);
            if (upperAnim) this._sampleAnimation(upperAnim, upperTime, loop);
        }

        // 3. Mask transforms: lower body from lowerCache, upper body blended by upperWeight
        const isUpper = this.upperBodyNodes;
        const isLower = this.lowerBodyNodes;
        const hipsIdx = this.hipsNodeIndex;

        for (let i = 0; i < nLen; i++) {
            const n = nodes[i];
            const l = lowerCache[i];

            if (i === hipsIdx) {
                // Hips node
                if (hipsBlend <= 0.001) {
                    n.translation[0] = l.t[0]; n.translation[1] = l.t[1]; n.translation[2] = l.t[2];
                    n.rotation[0] = l.r[0]; n.rotation[1] = l.r[1]; n.rotation[2] = l.r[2]; n.rotation[3] = l.r[3];
                    n.scale[0] = l.s[0]; n.scale[1] = l.s[1]; n.scale[2] = l.s[2];
                } else if (hipsBlend < 0.999) {
                    const hb = hipsBlend * upperWeight;
                    n.translation[0] = l.t[0] + (n.translation[0] - l.t[0]) * hb;
                    n.translation[1] = l.t[1] + (n.translation[1] - l.t[1]) * hb;
                    n.translation[2] = l.t[2] + (n.translation[2] - l.t[2]) * hb;
                    n.scale[0] = l.s[0] + (n.scale[0] - l.s[0]) * hb;
                    n.scale[1] = l.s[1] + (n.scale[1] - l.s[1]) * hb;
                    n.scale[2] = l.s[2] + (n.scale[2] - l.s[2]) * hb;
                    this._slerp(n.rotation, l.r, n.rotation, hb);
                }
            } else if (isUpper && isUpper[i]) {
                // Upper body node
                if (upperWeight < 0.999) {
                    n.translation[0] = l.t[0] + (n.translation[0] - l.t[0]) * upperWeight;
                    n.translation[1] = l.t[1] + (n.translation[1] - l.t[1]) * upperWeight;
                    n.translation[2] = l.t[2] + (n.translation[2] - l.t[2]) * upperWeight;
                    n.scale[0] = l.s[0] + (n.scale[0] - l.s[0]) * upperWeight;
                    n.scale[1] = l.s[1] + (n.scale[1] - l.s[1]) * upperWeight;
                    n.scale[2] = l.s[2] + (n.scale[2] - l.s[2]) * upperWeight;
                    this._slerp(n.rotation, l.r, n.rotation, upperWeight);
                }
            } else if (isLower && isLower[i]) {
                // Lower body node - always takes 100% from lower body animation
                n.translation[0] = l.t[0]; n.translation[1] = l.t[1]; n.translation[2] = l.t[2];
                n.rotation[0] = l.r[0]; n.rotation[1] = l.r[1]; n.rotation[2] = l.r[2]; n.rotation[3] = l.r[3];
                n.scale[0] = l.s[0]; n.scale[1] = l.s[1]; n.scale[2] = l.s[2];
            } else {
                // Root / mesh armature nodes
                n.translation[0] = l.t[0]; n.translation[1] = l.t[1]; n.translation[2] = l.t[2];
                n.rotation[0] = l.r[0]; n.rotation[1] = l.r[1]; n.rotation[2] = l.r[2]; n.rotation[3] = l.r[3];
                n.scale[0] = l.s[0]; n.scale[1] = l.s[1]; n.scale[2] = l.s[2];
            }
        }

        return this._applySkinningAndFinalize();
    }

    /**
     * Advanced layered blending where lower body can also transition between two locomotion states
     * (e.g. Walk -> Run or Idle -> Walk while swinging tool).
     */
    getSkinnedMeshMixed(options) {
        const {
            lowerAnim1, lowerTime1,
            lowerAnim2, lowerTime2,
            lowerBlend = 0.0,
            upperAnim, upperTime,
            upperWeight = 1.0,
            hipsBlend = 0.0,
            loop = true
        } = options;

        if (upperWeight <= 0.001 || !upperAnim) {
            if (lowerBlend > 0.001 && lowerAnim2) {
                return this.getSkinnedMeshBlended(lowerAnim1, lowerTime1, lowerAnim2, lowerTime2, lowerBlend, loop);
            }
            return this.getSkinnedMesh(lowerAnim1, lowerTime1, loop);
        }

        const nodes = this.nodes;
        const nLen = nodes.length;

        // 1. Prepare lower body layer
        if (lowerBlend > 0.001 && lowerAnim2) {
            this._resetNodeTransforms();
            if (this.animations && this.animations.length > 0) {
                const a1 = this.getAnimation(lowerAnim1);
                if (a1) this._sampleAnimation(a1, lowerTime1, loop);
            }
            const bCache = this.blendCacheState;
            for (let i = 0; i < nLen; i++) {
                const n = nodes[i];
                const c = bCache[i];
                c.t[0] = n.translation[0]; c.t[1] = n.translation[1]; c.t[2] = n.translation[2];
                c.r[0] = n.rotation[0]; c.r[1] = n.rotation[1]; c.r[2] = n.rotation[2]; c.r[3] = n.rotation[3];
                c.s[0] = n.scale[0]; c.s[1] = n.scale[1]; c.s[2] = n.scale[2];
            }

            this._resetNodeTransforms();
            if (this.animations && this.animations.length > 0) {
                const a2 = this.getAnimation(lowerAnim2);
                if (a2) this._sampleAnimation(a2, lowerTime2, loop);
            }

            const lCache = this.layerCacheState;
            for (let i = 0; i < nLen; i++) {
                const n = nodes[i];
                const b = bCache[i];
                const l = lCache[i];
                l.t[0] = b.t[0] + (n.translation[0] - b.t[0]) * lowerBlend;
                l.t[1] = b.t[1] + (n.translation[1] - b.t[1]) * lowerBlend;
                l.t[2] = b.t[2] + (n.translation[2] - b.t[2]) * lowerBlend;
                l.s[0] = b.s[0] + (n.scale[0] - b.s[0]) * lowerBlend;
                l.s[1] = b.s[1] + (n.scale[1] - b.s[1]) * lowerBlend;
                l.s[2] = b.s[2] + (n.scale[2] - b.s[2]) * lowerBlend;
                this._slerp(l.r, b.r, n.rotation, lowerBlend);
            }
        } else {
            this._resetNodeTransforms();
            if (this.animations && this.animations.length > 0) {
                const lowerAnim = this.getAnimation(lowerAnim1);
                if (lowerAnim) this._sampleAnimation(lowerAnim, lowerTime1, loop);
            }
            const lCache = this.layerCacheState;
            for (let i = 0; i < nLen; i++) {
                const n = nodes[i];
                const l = lCache[i];
                l.t[0] = n.translation[0]; l.t[1] = n.translation[1]; l.t[2] = n.translation[2];
                l.r[0] = n.rotation[0]; l.r[1] = n.rotation[1]; l.r[2] = n.rotation[2]; l.r[3] = n.rotation[3];
                l.s[0] = n.scale[0]; l.s[1] = n.scale[1]; l.s[2] = n.scale[2];
            }
        }

        // 2. Sample upper body animation into nodes
        this._resetNodeTransforms();
        if (this.animations && this.animations.length > 0) {
            const uAnim = this.getAnimation(upperAnim);
            if (uAnim) this._sampleAnimation(uAnim, upperTime, loop);
        }

        // 3. Mask transforms
        const isUpper = this.upperBodyNodes;
        const isLower = this.lowerBodyNodes;
        const hipsIdx = this.hipsNodeIndex;
        const lCache = this.layerCacheState;

        for (let i = 0; i < nLen; i++) {
            const n = nodes[i];
            const l = lCache[i];

            if (i === hipsIdx) {
                if (hipsBlend <= 0.001) {
                    n.translation[0] = l.t[0]; n.translation[1] = l.t[1]; n.translation[2] = l.t[2];
                    n.rotation[0] = l.r[0]; n.rotation[1] = l.r[1]; n.rotation[2] = l.r[2]; n.rotation[3] = l.r[3];
                    n.scale[0] = l.s[0]; n.scale[1] = l.s[1]; n.scale[2] = l.s[2];
                } else if (hipsBlend < 0.999) {
                    const hb = hipsBlend * upperWeight;
                    n.translation[0] = l.t[0] + (n.translation[0] - l.t[0]) * hb;
                    n.translation[1] = l.t[1] + (n.translation[1] - l.t[1]) * hb;
                    n.translation[2] = l.t[2] + (n.translation[2] - l.t[2]) * hb;
                    n.scale[0] = l.s[0] + (n.scale[0] - l.s[0]) * hb;
                    n.scale[1] = l.s[1] + (n.scale[1] - l.s[1]) * hb;
                    n.scale[2] = l.s[2] + (n.scale[2] - l.s[2]) * hb;
                    this._slerp(n.rotation, l.r, n.rotation, hb);
                }
            } else if (isUpper && isUpper[i]) {
                if (upperWeight < 0.999) {
                    n.translation[0] = l.t[0] + (n.translation[0] - l.t[0]) * upperWeight;
                    n.translation[1] = l.t[1] + (n.translation[1] - l.t[1]) * upperWeight;
                    n.translation[2] = l.t[2] + (n.translation[2] - l.t[2]) * upperWeight;
                    n.scale[0] = l.s[0] + (n.scale[0] - l.s[0]) * upperWeight;
                    n.scale[1] = l.s[1] + (n.scale[1] - l.s[1]) * upperWeight;
                    n.scale[2] = l.s[2] + (n.scale[2] - l.s[2]) * upperWeight;
                    this._slerp(n.rotation, l.r, n.rotation, upperWeight);
                }
            } else if (isLower && isLower[i]) {
                n.translation[0] = l.t[0]; n.translation[1] = l.t[1]; n.translation[2] = l.t[2];
                n.rotation[0] = l.r[0]; n.rotation[1] = l.r[1]; n.rotation[2] = l.r[2]; n.rotation[3] = l.r[3];
                n.scale[0] = l.s[0]; n.scale[1] = l.s[1]; n.scale[2] = l.s[2];
            } else {
                n.translation[0] = l.t[0]; n.translation[1] = l.t[1]; n.translation[2] = l.t[2];
                n.rotation[0] = l.r[0]; n.rotation[1] = l.r[1]; n.rotation[2] = l.r[2]; n.rotation[3] = l.r[3];
                n.scale[0] = l.s[0]; n.scale[1] = l.s[1]; n.scale[2] = l.s[2];
            }
        }

        return this._applySkinningAndFinalize();
    }
};
