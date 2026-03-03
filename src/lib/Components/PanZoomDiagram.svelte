<script lang="ts">
    import { onDestroy, tick } from "svelte";

    interface Props {
        svg: string;
        height?: string;
    }

    let { svg, height = "400px" }: Props = $props();

    let container: HTMLDivElement;
    let panZoomInstance: any = null;
    let resizeObserver: ResizeObserver | null = null;
    let initPending = false;

    async function initPanZoom() {
        // Guard against concurrent calls
        if (initPending) return;
        initPending = true;

        try {
            // Destroy previous instance + observer cleanly
            resizeObserver?.disconnect();
            resizeObserver = null;
            if (panZoomInstance) {
                panZoomInstance.destroy();
                panZoomInstance = null;
            }

            // Wait for Svelte to flush {@html svg} into the DOM
            await tick();

            if (!container) return;

            const svgEl = container.querySelector<SVGElement>("svg");
            if (!svgEl) return;

            // Make SVG fill the container fully
            svgEl.removeAttribute("width");
            svgEl.removeAttribute("height");
            svgEl.style.width = "100%";
            svgEl.style.height = "100%";
            svgEl.style.maxWidth = "none";
            svgEl.style.display = "block";

            const { default: svgPanZoom } = await import("svg-pan-zoom");

            // Double-check container still mounted after async import
            if (!container) return;

            panZoomInstance = svgPanZoom(svgEl, {
                zoomEnabled: true,
                controlIconsEnabled: true,
                fit: true,
                center: true,
                minZoom: 0.05,
                maxZoom: 20,
                zoomScaleSensitivity: 0.3,
                mouseWheelZoomEnabled: true,
                dblClickZoomEnabled: true,
                preventMouseEventsDefault: true,
            });

            // Re-fit whenever the container is resized
            resizeObserver = new ResizeObserver(() => {
                if (!panZoomInstance) return;
                panZoomInstance.resize();
                panZoomInstance.fit();
                panZoomInstance.center();
            });
            resizeObserver.observe(container);
        } finally {
            initPending = false;
        }
    }

    // $effect is the single source of truth — runs on mount AND whenever svg changes
    $effect(() => {
        // Read svg to register the dependency
        const _ = svg;
        if (container) {
            initPanZoom();
        }
    });

    onDestroy(() => {
        resizeObserver?.disconnect();
        resizeObserver = null;
        panZoomInstance?.destroy();
        panZoomInstance = null;
    });
</script>

<div
    bind:this={container}
    class="pan-zoom-container"
    style="height: {height}; width: 100%; position: relative; overflow: hidden; background: transparent;"
>
    {@html svg}
</div>

<style>
    .pan-zoom-container :global(svg) {
        width: 100%;
        height: 100%;
        max-width: none;
        display: block;
    }

    .pan-zoom-container :global(.svg-pan-zoom-control) {
        cursor: pointer;
        opacity: 0.5;
        transition: opacity 0.15s ease;
    }

    .pan-zoom-container :global(.svg-pan-zoom-control:hover) {
        opacity: 1;
    }

    .pan-zoom-container :global(.svg-pan-zoom-control-icons-container) {
        /* Push controls to bottom-right so they don't overlap the diagram title */
        top: auto !important;
        bottom: 8px !important;
        right: 8px !important;
        left: auto !important;
    }
</style>
