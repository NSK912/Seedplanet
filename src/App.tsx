/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

export default function App() {
  return (
    <main className="min-h-dvh w-full bg-slate-950 flex items-center justify-center p-[clamp(0.5rem,3vmin,2rem)]">
      <div
        id="startScreenSocialBar"
        className="flex items-center justify-center gap-[0.5em] mt-0 text-[length:clamp(8px,min(5.5vw,22vh),72px)] transition-opacity duration-[400ms] ease-in-out flex-nowrap whitespace-nowrap"
      >
        {/* YouTube Icon Link */}
        <a
          href="https://www.youtube.com/@Nat_suki452"
          target="_blank"
          rel="noopener noreferrer"
          className="w-[2.25em] h-[2.25em] bg-red-600/10 hover:bg-red-600/20 border-[length:max(1px,0.0625em)] border-red-500/20 rounded-[0.5em] flex items-center justify-center text-red-500 transition-all duration-200 shadow-md shrink-0"
          title="YouTube"
          aria-label="YouTube"
        >
          <svg className="w-[1em] h-[1em] fill-current" viewBox="0 0 24 24">
            <path d="M23.498 6.186a3.016 3.016 0 0 0-2.122-2.136C19.505 3.545 12 3.545 12 3.545s-7.505 0-9.377.505A3.017 3.017 0 0 0 .502 6.186C0 8.07 0 12 0 12s0 3.93.502 5.814a3.016 3.016 0 0 0 2.122 2.136c1.871.505 9.376.505 9.376.505s7.505 0 9.377-.505a3.015 3.015 0 0 0 2.122-2.136C24 15.93 24 12 24 12s0-3.93-.502-5.814zM9.545 15.568V8.432L15.818 12l-6.273 3.568z" />
          </svg>
        </a>

        {/* Microsoft Store Link */}
        <a
          href="https://apps.microsoft.com/store/detail/9N9DKCK3XTF0?cid=DevShareMCLPCS"
          target="_blank"
          rel="noopener noreferrer"
          className="h-[2.25em] px-[0.75em] flex items-center gap-[0.5em] bg-[#00a4ef]/10 hover:bg-[#00a4ef]/20 border-[length:max(1px,0.0625em)] border-[#00a4ef]/30 text-sky-400 rounded-[0.5em] font-medium transition-all duration-200 shadow-md shrink-0 no-underline"
          title="Microsoft Store"
        >
          <svg className="w-[0.9375em] h-[0.9375em] shrink-0" viewBox="0 0 24 24">
            <path fill="#f25022" d="M1 1h10v10H1z" />
            <path fill="#7fba00" d="M13 1h10v10H13z" />
            <path fill="#00a4ef" d="M1 13h10v10H1z" />
            <path fill="#ffb900" d="M13 13h10v10H13z" />
          </svg>
          <span className="text-[0.75em] leading-none">Microsoft Store</span>
        </a>
      </div>
    </main>
  );
}
