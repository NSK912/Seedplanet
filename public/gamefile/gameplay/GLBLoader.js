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
            translation: n.translation || [0,0,0],
            rotation: n.rotation || [0,0,0,1],
            scale: n.scale || [1,1,1],
            children: n.children || [],
            matrix: new Float32Array(16),
            localMatrix: new Float32Array(16)
        }));

        this.nodes.forEach((n, i) => {
            n.children.forEach(c => {
                this.nodes[c].parent = i;
            });
        });
        
        this.rootNodes = [];
        this.nodes.forEach((n, i) => {
            if (n.parent === undefined) this.rootNodes.push(i);
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

    getSkinnedMeshBlended(animName1, time1, animName2, time2, factor, loop=true) {
        if (factor <= 0.0) return this.getSkinnedMesh(animName1, time1, loop);
        if (factor >= 1.0) return this.getSkinnedMesh(animName2, time2, loop);

        // 1. Reset node transforms
        this.nodes.forEach(n => {
            n.translation = n.translation.slice();
            n.rotation = n.rotation.slice();
            n.scale = n.scale.slice();
        });

        // 2. Sample Animation 1
        if (this.animations && this.animations.length > 0) {
            const anim1 = this.getAnimation(animName1);
            if (anim1) {
                let t = time1;
                if (loop && anim1.duration > 0) t = t % anim1.duration;
                if (t < 0) t += anim1.duration;
                anim1.channels.forEach(ch => {
                    const times = ch.input;
                    const values = ch.output;
                    let frame = 0;
                    while (frame < times.length - 1 && times[frame + 1] <= t) frame++;
                    const n = this.nodes[ch.node];
                    if (frame >= times.length - 1) {
                        if (loop && anim1.duration > times[frame]) {
                            const t0 = times[frame];
                            const t1 = anim1.duration;
                            const f = (t - t0) / (t1 - t0);
                            if (ch.path === 'translation') {
                                this._lerpVec3(n.translation, values, values, f, frame*3, 0);
                            } else if (ch.path === 'rotation') {
                                const q0 = [values[frame*4], values[frame*4+1], values[frame*4+2], values[frame*4+3]];
                                const q1 = [values[0], values[1], values[2], values[3]];
                                this._slerp(n.rotation, q0, q1, f);
                            } else if (ch.path === 'scale') {
                                this._lerpVec3(n.scale, values, values, f, frame*3, 0);
                            }
                        } else {
                            if (ch.path === 'translation') {
                                n.translation[0] = values[frame*3]; n.translation[1] = values[frame*3+1]; n.translation[2] = values[frame*3+2];
                            } else if (ch.path === 'rotation') {
                                n.rotation[0] = values[frame*4]; n.rotation[1] = values[frame*4+1]; n.rotation[2] = values[frame*4+2]; n.rotation[3] = values[frame*4+3];
                            } else if (ch.path === 'scale') {
                                n.scale[0] = values[frame*3]; n.scale[1] = values[frame*3+1]; n.scale[2] = values[frame*3+2];
                            }
                        }
                    } else {
                        const t0 = times[frame];
                        const t1 = times[frame + 1];
                        const f = (t - t0) / (t1 - t0);
                        if (ch.path === 'translation') {
                            this._lerpVec3(n.translation, values, values, f, frame*3, (frame+1)*3);
                        } else if (ch.path === 'rotation') {
                            const q0 = [values[frame*4], values[frame*4+1], values[frame*4+2], values[frame*4+3]];
                            const q1 = [values[(frame+1)*4], values[(frame+1)*4+1], values[(frame+1)*4+2], values[(frame+1)*4+3]];
                            this._slerp(n.rotation, q0, q1, f);
                        } else if (ch.path === 'scale') {
                            this._lerpVec3(n.scale, values, values, f, frame*3, (frame+1)*3);
                        }
                    }
                });
            }
        }

        // Save Anim1 state
        const anim1State = this.nodes.map(n => ({
            t: n.translation.slice(),
            r: n.rotation.slice(),
            s: n.scale.slice()
        }));

        // Reset again
        this.nodes.forEach(n => {
            n.translation = n.translation.slice();
            n.rotation = n.rotation.slice();
            n.scale = n.scale.slice();
        });

        // 3. Sample Animation 2
        if (this.animations && this.animations.length > 0) {
            const anim2 = this.getAnimation(animName2);
            if (anim2) {
                let t = time2;
                if (loop && anim2.duration > 0) t = t % anim2.duration;
                if (t < 0) t += anim2.duration;
                anim2.channels.forEach(ch => {
                    const times = ch.input;
                    const values = ch.output;
                    let frame = 0;
                    while (frame < times.length - 1 && times[frame + 1] <= t) frame++;
                    const n = this.nodes[ch.node];
                    if (frame >= times.length - 1) {
                        if (loop && anim2.duration > times[frame]) {
                            const t0 = times[frame];
                            const t1 = anim2.duration;
                            const f = (t - t0) / (t1 - t0);
                            if (ch.path === 'translation') {
                                this._lerpVec3(n.translation, values, values, f, frame*3, 0);
                            } else if (ch.path === 'rotation') {
                                const q0 = [values[frame*4], values[frame*4+1], values[frame*4+2], values[frame*4+3]];
                                const q1 = [values[0], values[1], values[2], values[3]];
                                this._slerp(n.rotation, q0, q1, f);
                            } else if (ch.path === 'scale') {
                                this._lerpVec3(n.scale, values, values, f, frame*3, 0);
                            }
                        } else {
                            if (ch.path === 'translation') {
                                n.translation[0] = values[frame*3]; n.translation[1] = values[frame*3+1]; n.translation[2] = values[frame*3+2];
                            } else if (ch.path === 'rotation') {
                                n.rotation[0] = values[frame*4]; n.rotation[1] = values[frame*4+1]; n.rotation[2] = values[frame*4+2]; n.rotation[3] = values[frame*4+3];
                            } else if (ch.path === 'scale') {
                                n.scale[0] = values[frame*3]; n.scale[1] = values[frame*3+1]; n.scale[2] = values[frame*3+2];
                            }
                        }
                    } else {
                        const t0 = times[frame];
                        const t1 = times[frame + 1];
                        const f = (t - t0) / (t1 - t0);
                        if (ch.path === 'translation') {
                            this._lerpVec3(n.translation, values, values, f, frame*3, (frame+1)*3);
                        } else if (ch.path === 'rotation') {
                            const q0 = [values[frame*4], values[frame*4+1], values[frame*4+2], values[frame*4+3]];
                            const q1 = [values[(frame+1)*4], values[(frame+1)*4+1], values[(frame+1)*4+2], values[(frame+1)*4+3]];
                            this._slerp(n.rotation, q0, q1, f);
                        } else if (ch.path === 'scale') {
                            this._lerpVec3(n.scale, values, values, f, frame*3, (frame+1)*3);
                        }
                    }
                });
            }
        }

        // 4. Blend Anim1 and Anim2
        this.nodes.forEach((n, i) => {
            const s1 = anim1State[i];
            
            // Lerp translation
            n.translation[0] = s1.t[0] + (n.translation[0] - s1.t[0]) * factor;
            n.translation[1] = s1.t[1] + (n.translation[1] - s1.t[1]) * factor;
            n.translation[2] = s1.t[2] + (n.translation[2] - s1.t[2]) * factor;
            
            // Lerp scale
            n.scale[0] = s1.s[0] + (n.scale[0] - s1.s[0]) * factor;
            n.scale[1] = s1.s[1] + (n.scale[1] - s1.s[1]) * factor;
            n.scale[2] = s1.s[2] + (n.scale[2] - s1.s[2]) * factor;
            
            // Slerp rotation
            this._slerp(n.rotation, s1.r, n.rotation, factor);
        });

        // 5. Update hierarchy
        this.rootNodes.forEach(r => this._updateHierarchy(r, null));

        // 4. Compute joint matrices
        if (this.skin) {
            for (let i = 0; i < this.skin.joints.length; i++) {
                const jointNodeIdx = this.skin.joints[i];
                const invBindOffset = i * 16;
                const invBind = this.skin.inverseBindMatrices.subarray(invBindOffset, invBindOffset + 16);
                const jointMat = this.jointMatrices.subarray(i * 16, i * 16 + 16);
                this._multiplyMat4(jointMat, this.nodes[jointNodeIdx].matrix, invBind);
            }
        }

        // 5. Apply skinning
        const bp = this.basePositions;
        const bn = this.baseNormals;
        const op = this.outPositions;
        const on = this.outNormals;
        const jts = this.joints;
        const wts = this.weights;
        const jm = this.jointMatrices;

        for (let i = 0; i < this.vertexCount; i++) {
            const i3 = i * 3;
            const i4 = i * 4;
            
            let px = 0, py = 0, pz = 0;
            let nx = 0, ny = 0, nz = 0;
            
            const bx = bp[i3], by = bp[i3+1], bz = bp[i3+2];
            const mx = bn[i3], my = bn[i3+1], mz = bn[i3+2];

            for (let j = 0; j < 4; j++) {
                const weight = wts[i4 + j];
                if (weight > 0) {
                    const jointIdx = jts[i4 + j];
                    const matOffset = jointIdx * 16;
                    
                    px += (jm[matOffset]*bx + jm[matOffset+4]*by + jm[matOffset+8]*bz + jm[matOffset+12]) * weight;
                    py += (jm[matOffset+1]*bx + jm[matOffset+5]*by + jm[matOffset+9]*bz + jm[matOffset+13]) * weight;
                    pz += (jm[matOffset+2]*bx + jm[matOffset+6]*by + jm[matOffset+10]*bz + jm[matOffset+14]) * weight;
                    
                    nx += (jm[matOffset]*mx + jm[matOffset+4]*my + jm[matOffset+8]*mz) * weight;
                    ny += (jm[matOffset+1]*mx + jm[matOffset+5]*my + jm[matOffset+9]*mz) * weight;
                    nz += (jm[matOffset+2]*mx + jm[matOffset+6]*my + jm[matOffset+10]*mz) * weight;
                }
            }
            
            op[i3] = px; op[i3+1] = py; op[i3+2] = pz;
            
            const l = Math.sqrt(nx*nx + ny*ny + nz*nz);
            if (l > 0.00001) {
                on[i3] = nx/l; on[i3+1] = ny/l; on[i3+2] = nz/l;
            } else {
                on[i3] = 0; on[i3+1] = 1; on[i3+2] = 0;
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

    getSkinnedMesh(animName, time, loop=true) {
        // 1. Reset node transforms
        this.nodes.forEach(n => {
            n.translation = n.translation.slice();
            n.rotation = n.rotation.slice();
            n.scale = n.scale.slice();
        });

        // 2. Sample Animation
        if (this.animations && this.animations.length > 0) {
            const anim = this.getAnimation(animName);
            if (anim) {
                let t = time;
                if (loop && anim.duration > 0) t = t % anim.duration;
                if (t < 0) t += anim.duration;

                anim.channels.forEach(ch => {
                    const times = ch.input;
                    const values = ch.output;
                    let frame = 0;
                    while (frame < times.length - 1 && times[frame + 1] <= t) frame++;
                    
                    const n = this.nodes[ch.node];
                    if (frame >= times.length - 1) {
                        if (loop && anim.duration > times[frame]) {
                            const t0 = times[frame];
                            const t1 = anim.duration;
                            const f = (t - t0) / (t1 - t0);
                            if (ch.path === 'translation') {
                                this._lerpVec3(n.translation, values, values, f, frame*3, 0);
                            } else if (ch.path === 'rotation') {
                                const q0 = [values[frame*4], values[frame*4+1], values[frame*4+2], values[frame*4+3]];
                                const q1 = [values[0], values[1], values[2], values[3]];
                                this._slerp(n.rotation, q0, q1, f);
                            } else if (ch.path === 'scale') {
                                this._lerpVec3(n.scale, values, values, f, frame*3, 0);
                            }
                        } else {
                            if (ch.path === 'translation') {
                                n.translation[0] = values[frame*3]; n.translation[1] = values[frame*3+1]; n.translation[2] = values[frame*3+2];
                            } else if (ch.path === 'rotation') {
                                n.rotation[0] = values[frame*4]; n.rotation[1] = values[frame*4+1]; n.rotation[2] = values[frame*4+2]; n.rotation[3] = values[frame*4+3];
                            } else if (ch.path === 'scale') {
                                n.scale[0] = values[frame*3]; n.scale[1] = values[frame*3+1]; n.scale[2] = values[frame*3+2];
                            }
                        }
                    } else {
                        const t0 = times[frame];
                        const t1 = times[frame + 1];
                        const factor = (t - t0) / (t1 - t0);
                        if (ch.path === 'translation') {
                            this._lerpVec3(n.translation, values, values, factor, frame*3, (frame+1)*3);
                        } else if (ch.path === 'rotation') {
                            const q0 = [values[frame*4], values[frame*4+1], values[frame*4+2], values[frame*4+3]];
                            const q1 = [values[(frame+1)*4], values[(frame+1)*4+1], values[(frame+1)*4+2], values[(frame+1)*4+3]];
                            this._slerp(n.rotation, q0, q1, factor);
                        } else if (ch.path === 'scale') {
                            this._lerpVec3(n.scale, values, values, factor, frame*3, (frame+1)*3);
                        }
                    }
                });
            }
        }

        // 3. Update hierarchy
        this.rootNodes.forEach(r => this._updateHierarchy(r, null));

        // 4. Compute joint matrices
        if (this.skin) {
            for (let i = 0; i < this.skin.joints.length; i++) {
                const jointNodeIdx = this.skin.joints[i];
                const invBindOffset = i * 16;
                const invBind = this.skin.inverseBindMatrices.subarray(invBindOffset, invBindOffset + 16);
                const jointMat = this.jointMatrices.subarray(i * 16, i * 16 + 16);
                this._multiplyMat4(jointMat, this.nodes[jointNodeIdx].matrix, invBind);
            }
        }

        // 5. Apply skinning
        const bp = this.basePositions;
        const bn = this.baseNormals;
        const op = this.outPositions;
        const on = this.outNormals;
        const jts = this.joints;
        const wts = this.weights;
        const jm = this.jointMatrices;

        for (let i = 0; i < this.vertexCount; i++) {
            const i3 = i * 3;
            const i4 = i * 4;
            
            let px = 0, py = 0, pz = 0;
            let nx = 0, ny = 0, nz = 0;
            
            const bx = bp[i3], by = bp[i3+1], bz = bp[i3+2];
            const bnx = bn[i3], bny = bn[i3+1], bnz = bn[i3+2];

            for (let j = 0; j < 4; j++) {
                const weight = wts[i4 + j];
                if (weight > 0.0) {
                    const jointIdx = jts[i4 + j] * 16;
                    
                    // Matrix transform
                    const m00 = jm[jointIdx], m01 = jm[jointIdx+4], m02 = jm[jointIdx+8], m03 = jm[jointIdx+12];
                    const m10 = jm[jointIdx+1], m11 = jm[jointIdx+5], m12 = jm[jointIdx+9], m13 = jm[jointIdx+13];
                    const m20 = jm[jointIdx+2], m21 = jm[jointIdx+6], m22 = jm[jointIdx+10], m23 = jm[jointIdx+14];
                    
                    px += weight * (m00 * bx + m01 * by + m02 * bz + m03);
                    py += weight * (m10 * bx + m11 * by + m12 * bz + m13);
                    pz += weight * (m20 * bx + m21 * by + m22 * bz + m23);
                    
                    nx += weight * (m00 * bnx + m01 * bny + m02 * bnz);
                    ny += weight * (m10 * bnx + m11 * bny + m12 * bnz);
                    nz += weight * (m20 * bnx + m21 * bny + m22 * bnz);
                }
            }

            op[i3] = px; op[i3+1] = py; op[i3+2] = pz;
            
            // Normalize normal
            const nlen = Math.sqrt(nx*nx + ny*ny + nz*nz);
            if (nlen > 0) {
                on[i3] = nx / nlen;
                on[i3+1] = ny / nlen;
                on[i3+2] = nz / nlen;
            } else {
                on[i3] = bnx; on[i3+1] = bny; on[i3+2] = bnz;
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
};
