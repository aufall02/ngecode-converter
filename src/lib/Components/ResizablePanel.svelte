<script lang="ts">
    import { onMount, onDestroy } from "svelte";

    interface Props {
        direction?: "horizontal" | "vertical";
        defaultSplit?: number;
        minSize?: number;
        maxSize?: number;
        first: import("svelte").Snippet;
        second: import("svelte").Snippet;
    }

    let {
        direction = "horizontal",
        defaultSplit = 50,
        minSize = 20,
        maxSize = 80,
        first,
        second,
    }: Props = $props();

    let split = $state(defaultSplit);
    let isDragging = $state(false);
    let container: HTMLDivElement;

    function onMouseDown(e: MouseEvent) {
        e.preventDefault();
        isDragging = true;
    }

    function onMouseMove(e: MouseEvent) {
        if (!isDragging || !container) return;

        const rect = container.getBoundingClientRect();

        let newSplit: number;
        if (direction === "horizontal") {
            newSplit = ((e.clientX - rect.left) / rect.width) * 100;
        } else {
            newSplit = ((e.clientY - rect.top) / rect.height) * 100;
        }

        split = Math.min(maxSize, Math.max(minSize, newSplit));
    }

    function onMouseUp() {
        isDragging = false;
    }

    function onTouchStart(e: TouchEvent) {
        e.preventDefault();
        isDragging = true;
    }

    function onTouchMove(e: TouchEvent) {
        if (!isDragging || !container || !e.touches[0]) return;

        const rect = container.getBoundingClientRect();
        const touch = e.touches[0];

        let newSplit: number;
        if (direction === "horizontal") {
            newSplit = ((touch.clientX - rect.left) / rect.width) * 100;
        } else {
            newSplit = ((touch.clientY - rect.top) / rect.height) * 100;
        }

        split = Math.min(maxSize, Math.max(minSize, newSplit));
    }

    function onTouchEnd() {
        isDragging = false;
    }

    onMount(() => {
        window.addEventListener("mousemove", onMouseMove);
        window.addEventListener("mouseup", onMouseUp);
        window.addEventListener("touchmove", onTouchMove, { passive: false });
        window.addEventListener("touchend", onTouchEnd);

        return () => {
            window.removeEventListener("mousemove", onMouseMove);
            window.removeEventListener("mouseup", onMouseUp);
            window.removeEventListener("touchmove", onTouchMove);
            window.removeEventListener("touchend", onTouchEnd);
        };
    });

    onDestroy(() => {
        window.removeEventListener("mousemove", onMouseMove);
        window.removeEventListener("mouseup", onMouseUp);
        window.removeEventListener("touchmove", onTouchMove);
        window.removeEventListener("touchend", onTouchEnd);
    });

    const isHorizontal = $derived(direction === "horizontal");

    const firstStyle = $derived(
        isHorizontal
            ? `width: ${split}%; height: 100%;`
            : `width: 100%; height: ${split}%;`
    );

    const secondStyle = $derived(
        isHorizontal
            ? `width: ${100 - split}%; height: 100%;`
            : `width: 100%; height: ${100 - split}%;`
    );
</script>

<!-- svelte-ignore a11y_no_static_element_interactions -->
<div
    bind:this={container}
    class="resizable-container"
    class:horizontal={isHorizontal}
    class:vertical={!isHorizontal}
    class:dragging={isDragging}
>
    <!-- First Panel -->
    <div class="panel panel-first" style={firstStyle}>
        {@render first()}
    </div>

    <!-- Divider / Handle -->
    <div
        class="divider"
        class:divider-horizontal={isHorizontal}
        class:divider-vertical={!isHorizontal}
        onmousedown={onMouseDown}
        ontouchstart={onTouchStart}
        role="separator"
        aria-orientation={isHorizontal ? "vertical" : "horizontal"}
        aria-valuenow={split}
        aria-valuemin={minSize}
        aria-valuemax={maxSize}
        title="Drag to resize"
    >
        <div class="divider-handle">
            {#if isHorizontal}
                <div class="dots">
                    <span></span>
                    <span></span>
                    <span></span>
                    <span></span>
                    <span></span>
                    <span></span>
                </div>
            {:else}
                <div class="dots dots-horizontal">
                    <span></span>
                    <span></span>
                    <span></span>
                    <span></span>
                    <span></span>
                    <span></span>
                </div>
            {/if}
        </div>
    </div>

    <!-- Second Panel -->
    <div class="panel panel-second" style={secondStyle}>
        {@render second()}
    </div>
</div>

<style>
    .resizable-container {
        display: flex;
        width: 100%;
        height: 100%;
        overflow: hidden;
        position: relative;
    }

    .resizable-container.horizontal {
        flex-direction: row;
    }

    .resizable-container.vertical {
        flex-direction: column;
    }

    .resizable-container.dragging {
        user-select: none;
    }

    .resizable-container.dragging.horizontal {
        cursor: col-resize;
    }

    .resizable-container.dragging.vertical {
        cursor: row-resize;
    }

    .panel {
        overflow: hidden;
        flex-shrink: 0;
        position: relative;
    }

    /* Divider */
    .divider {
        flex-shrink: 0;
        display: flex;
        align-items: center;
        justify-content: center;
        background-color: #EEE8D5;
        transition: background-color 0.15s ease;
        position: relative;
        z-index: 10;
    }

    .divider:hover,
    .resizable-container.dragging .divider {
        background-color: #93a1a1;
    }

    .divider-horizontal {
        width: 5px;
        height: 100%;
        cursor: col-resize;
    }

    .divider-vertical {
        width: 100%;
        height: 5px;
        cursor: row-resize;
    }

    .divider-handle {
        display: flex;
        align-items: center;
        justify-content: center;
        border-radius: 4px;
        padding: 2px;
        opacity: 0.5;
        transition: opacity 0.15s ease;
    }

    .divider:hover .divider-handle,
    .resizable-container.dragging .divider-handle {
        opacity: 1;
    }

    .dots {
        display: flex;
        flex-direction: column;
        gap: 3px;
        align-items: center;
    }

    .dots-horizontal {
        flex-direction: row;
    }

    .dots span {
        display: block;
        width: 3px;
        height: 3px;
        border-radius: 50%;
        background-color: #657b83;
    }

    .divider:hover .dots span,
    .resizable-container.dragging .dots span {
        background-color: #FDF6E3;
    }
</style>
