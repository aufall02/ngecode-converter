<script lang="ts">
    import { Play, Pause, SkipBack, SkipForward, Square, Gauge } from "lucide-svelte";
    import type { LogEntry } from "$lib/trace/runner";

    interface Props {
        /** Total steps in the current trace */
        totalSteps: number;
        /** Current step index (0-based, -1 = not started) */
        currentStep: number;
        /** Whether animation is actively playing */
        isPlaying: boolean;
        /** Whether the worker is still executing the code */
        isExecuting: boolean;
        /** Error from execution, if any */
        execError: string | null;
        /** Captured console output */
        logs: LogEntry[];
        /** Animation speed in ms per step */
        speedMs: number;
        onPlay: () => void;
        onPause: () => void;
        onStepBack: () => void;
        onStepForward: () => void;
        onReset: () => void;
        onRerun: () => void;
        onSpeedChange: (ms: number) => void;
    }

    const {
        totalSteps,
        currentStep,
        isPlaying,
        isExecuting,
        execError,
        logs,
        speedMs,
        onPlay,
        onPause,
        onStepBack,
        onStepForward,
        onReset,
        onRerun,
        onSpeedChange,
    }: Props = $props();

    const SPEEDS = [
        { label: "Slow",   ms: 900 },
        { label: "Normal", ms: 400 },
        { label: "Fast",   ms: 120 },
    ] as const;

    const progress = $derived(
        totalSteps > 0 ? Math.round(((currentStep + 1) / totalSteps) * 100) : 0,
    );

    const stepLabel = $derived(
        totalSteps === 0
            ? "—"
            : currentStep < 0
              ? `0 / ${totalSteps}`
              : `${currentStep + 1} / ${totalSteps}`,
    );

    const isDone = $derived(currentStep >= totalSteps - 1 && totalSteps > 0);

    let showConsole = $state(true);
</script>

<div class="flex flex-col border-t border-[#93a1a1]/20 bg-[#FDF6E3] select-none">

    <!-- ── Control bar ──────────────────────────────────────────────────────── -->
    <div class="flex items-center gap-2 px-3 py-2 flex-wrap">

        <!-- Playback buttons -->
        <div class="flex items-center gap-0.5">
            <!-- Reset -->
            <button
                onclick={onReset}
                disabled={isExecuting}
                title="Reset (kembali ke awal)"
                class="p-1.5 rounded hover:bg-[#93a1a1]/15 text-[#93a1a1] hover:text-[#586e75]
                       disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
            >
                <SkipBack size={13} />
            </button>

            <!-- Step back -->
            <button
                onclick={onStepBack}
                disabled={isExecuting || isPlaying || currentStep <= 0}
                title="Langkah sebelumnya"
                class="p-1.5 rounded hover:bg-[#93a1a1]/15 text-[#93a1a1] hover:text-[#586e75]
                       disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
            >
                <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round">
                    <polygon points="19 20 9 12 19 4 19 20"/>
                    <line x1="5" y1="19" x2="5" y2="5"/>
                </svg>
            </button>

            <!-- Play / Pause -->
            {#if isExecuting}
                <!-- Spinner saat worker masih jalan -->
                <div class="p-1.5 flex items-center justify-center" title="Menjalankan kode...">
                    <svg class="animate-spin text-[#268bd2]" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5">
                        <path d="M21 12a9 9 0 1 1-6.219-8.56"/>
                    </svg>
                </div>
            {:else if isPlaying}
                <button
                    onclick={onPause}
                    title="Pause"
                    class="p-1.5 rounded bg-[#268bd2]/10 text-[#268bd2] hover:bg-[#268bd2]/20 transition-colors"
                >
                    <Pause size={14} />
                </button>
            {:else if isDone}
                <button
                    onclick={onRerun}
                    disabled={isExecuting}
                    title="Jalankan ulang"
                    class="p-1.5 rounded bg-[#859900]/10 text-[#859900] hover:bg-[#859900]/20
                           disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
                >
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round">
                        <path d="M3 12a9 9 0 1 0 9-9 9.75 9.75 0 0 0-6.74 2.74L3 8"/>
                        <path d="M3 3v5h5"/>
                    </svg>
                </button>
            {:else}
                <button
                    onclick={onPlay}
                    disabled={isExecuting}
                    title="Play"
                    class="p-1.5 rounded bg-[#268bd2]/10 text-[#268bd2] hover:bg-[#268bd2]/20
                           disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
                >
                    <Play size={14} />
                </button>
            {/if}

            <!-- Step forward -->
            <button
                onclick={onStepForward}
                disabled={isExecuting || isPlaying || isDone}
                title="Langkah berikutnya"
                class="p-1.5 rounded hover:bg-[#93a1a1]/15 text-[#93a1a1] hover:text-[#586e75]
                       disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
            >
                <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round">
                    <polygon points="5 4 15 12 5 20 5 4"/>
                    <line x1="19" y1="5" x2="19" y2="19"/>
                </svg>
            </button>

            <!-- Stop / done indicator -->
            {#if isDone && !isExecuting}
                <span class="ml-1 text-xs text-[#859900] font-medium flex items-center gap-1">
                    <Square size={10} class="fill-[#859900]" />
                    Selesai
                </span>
            {/if}
        </div>

        <!-- Divider -->
        <div class="w-px h-4 bg-[#93a1a1]/25 shrink-0"></div>

        <!-- Progress -->
        <div class="flex items-center gap-2 flex-1 min-w-0">
            <!-- Bar -->
            <div class="flex-1 min-w-[60px] max-w-[160px] h-1.5 bg-[#93a1a1]/20 rounded-full overflow-hidden">
                <div
                    class="h-full rounded-full transition-all duration-200
                           {isDone ? 'bg-[#859900]' : 'bg-[#268bd2]'}"
                    style="width: {progress}%"
                ></div>
            </div>
            <!-- Step counter -->
            <span class="text-xs text-[#93a1a1] font-mono shrink-0">{stepLabel}</span>
        </div>

        <!-- Divider -->
        <div class="w-px h-4 bg-[#93a1a1]/25 shrink-0"></div>

        <!-- Speed selector -->
        <div class="flex items-center gap-1.5">
            <Gauge size={12} class="text-[#93a1a1] shrink-0" />
            <div class="flex gap-0.5">
                {#each SPEEDS as s}
                    <button
                        onclick={() => onSpeedChange(s.ms)}
                        class="px-2 py-0.5 rounded text-xs transition-colors
                               {speedMs === s.ms
                                   ? 'bg-[#268bd2]/15 text-[#268bd2] font-medium'
                                   : 'text-[#93a1a1] hover:text-[#586e75] hover:bg-[#93a1a1]/10'}"
                    >
                        {s.label}
                    </button>
                {/each}
            </div>
        </div>

        <!-- Divider -->
        <div class="w-px h-4 bg-[#93a1a1]/25 shrink-0"></div>

        <!-- Console toggle -->
        <button
            onclick={() => (showConsole = !showConsole)}
            class="flex items-center gap-1 text-xs px-2 py-0.5 rounded transition-colors
                   {showConsole
                       ? 'bg-[#657b83]/10 text-[#586e75]'
                       : 'text-[#93a1a1] hover:text-[#586e75] hover:bg-[#93a1a1]/10'}"
            title="Toggle console output"
        >
            <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round">
                <polyline points="4 17 10 11 4 5"/>
                <line x1="12" y1="19" x2="20" y2="19"/>
            </svg>
            Console
            {#if logs.length > 0}
                <span class="bg-[#657b83]/20 text-[#586e75] rounded-full px-1 leading-none py-0.5 font-mono">
                    {logs.length}
                </span>
            {/if}
        </button>
    </div>

    <!-- ── Error banner ─────────────────────────────────────────────────────── -->
    {#if execError}
        <div class="mx-3 mb-2 flex items-start gap-2 bg-[#dc322f]/8 border border-[#dc322f]/20 rounded-lg px-3 py-2">
            <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round" class="text-[#dc322f] mt-0.5 shrink-0">
                <circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/>
            </svg>
            <p class="text-xs text-[#dc322f] font-mono leading-relaxed">{execError}</p>
        </div>
    {/if}

    <!-- ── Console output ───────────────────────────────────────────────────── -->
    {#if showConsole}
        <div class="mx-3 mb-2 rounded-lg border border-[#93a1a1]/20 bg-[#002b36] overflow-hidden">
            <!-- Console header -->
            <div class="flex items-center justify-between px-3 py-1.5 border-b border-white/5">
                <span class="text-xs text-[#93a1a1]/60 font-mono">console</span>
                {#if logs.length === 0 && !isExecuting}
                    <span class="text-xs text-[#93a1a1]/40 italic">no output</span>
                {/if}
            </div>

            <!-- Log lines -->
            <div class="max-h-36 overflow-y-auto px-3 py-2 space-y-0.5 font-mono text-xs">
                {#if isExecuting}
                    <div class="flex items-center gap-2 text-[#93a1a1]/50">
                        <svg class="animate-spin shrink-0" width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5">
                            <path d="M21 12a9 9 0 1 1-6.219-8.56"/>
                        </svg>
                        <span>menjalankan...</span>
                    </div>
                {:else if logs.length === 0}
                    <span class="text-[#93a1a1]/30 italic">—</span>
                {:else}
                    {#each logs as entry}
                        <div class="flex items-start gap-2 leading-relaxed">
                            <span class="shrink-0 mt-0.5
                                {entry.level === 'warn'  ? 'text-[#b58900]' :
                                 entry.level === 'error' ? 'text-[#dc322f]' :
                                 entry.level === 'info'  ? 'text-[#268bd2]' :
                                                           'text-[#93a1a1]/50'}">
                                {entry.level === 'warn'  ? '⚠' :
                                 entry.level === 'error' ? '✖' :
                                 entry.level === 'info'  ? 'ℹ' : '>'}
                            </span>
                            <span class="
                                {entry.level === 'warn'  ? 'text-[#b58900]' :
                                 entry.level === 'error' ? 'text-[#dc322f]' :
                                 entry.level === 'info'  ? 'text-[#268bd2]' :
                                                           'text-[#839496]'}
                                break-all whitespace-pre-wrap">
                                {entry.text}
                            </span>
                        </div>
                    {/each}
                {/if}
            </div>
        </div>
    {/if}

</div>
