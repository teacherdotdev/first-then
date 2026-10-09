<!-- In-page camera viewfinder for devices whose browser can't open the system camera
     from a file input (laptops, desktops). The frame never leaves the device. -->
<script lang="ts">
  import { onDestroy, onMount } from "svelte";
  import Icon from "#lib/components/Icon.svelte";

  let {
    oncapture,
    oncancel,
  }: { oncapture: (blob: Blob) => void; oncancel: () => void } = $props();

  let video = $state<HTMLVideoElement>();
  let stream: MediaStream | null = null;
  let destroyed = false;
  let ready = $state(false);
  let mirrored = $state(true);
  let error = $state<string | null>(null);

  function friendlyError(err: unknown): string {
    const name = err instanceof DOMException ? err.name : "";
    if (name === "NotAllowedError" || name === "SecurityError")
      return "Camera access is blocked. Allow the camera in your browser's settings, or choose a photo instead.";
    if (name === "NotFoundError" || name === "OverconstrainedError")
      return "No camera was found on this device.";
    if (name === "NotReadableError")
      return "The camera is being used by another app. Close it and try again.";
    return "The camera couldn't be started. Please try again, or choose a photo instead.";
  }

  function stop() {
    for (const track of stream?.getTracks() ?? []) track.stop();
    stream = null;
  }

  onMount(async () => {
    if (!navigator.mediaDevices?.getUserMedia) {
      error = "This browser can't use the camera here. Choose a photo instead.";
      return;
    }
    try {
      const s = await navigator.mediaDevices.getUserMedia({
        video: {
          facingMode: { ideal: "environment" },
          width: { ideal: 1280 },
          height: { ideal: 1280 },
        },
        audio: false,
      });
      if (destroyed) {
        for (const track of s.getTracks()) track.stop();
        return;
      }
      stream = s;
      // Mirror the preview like a mirror for a selfie camera; the saved photo isn't.
      mirrored =
        s.getVideoTracks()[0]?.getSettings().facingMode !== "environment";
      if (!video) return stop();
      video.srcObject = s;
      await video.play();
    } catch (err) {
      stop();
      error = friendlyError(err);
    }
  });

  onDestroy(() => {
    destroyed = true;
    stop();
  });

  function capture() {
    if (!video) return;
    const width = video.videoWidth;
    const height = video.videoHeight;
    if (!width || !height) return;
    const canvas = document.createElement("canvas");
    canvas.width = width;
    canvas.height = height;
    canvas.getContext("2d")?.drawImage(video, 0, 0, width, height);
    canvas.toBlob(
      (blob) => {
        canvas.width = 0;
        canvas.height = 0;
        if (!blob) {
          error = "The photo couldn't be taken. Please try again.";
          return;
        }
        stop();
        oncapture(blob);
      },
      "image/jpeg",
      0.92,
    );
  }
</script>

<div
  class="flex flex-col gap-3 rounded-xl border-2 border-blue-200 bg-white p-3"
>
  {#if error}
    <p class="text-red-700" role="alert">{error}</p>
  {:else}
    <div class="overflow-hidden rounded-lg bg-slate-900">
      <video
        bind:this={video}
        class="mx-auto max-h-[50vh] w-full object-contain"
        class:-scale-x-100={mirrored}
        playsinline
        muted
        onplaying={() => (ready = true)}
      ></video>
    </div>
    {#if !ready}
      <p class="text-center text-slate-600" role="status">
        Starting the camera…
      </p>
    {/if}
  {/if}
  <div class="flex flex-wrap justify-end gap-2">
    <button
      type="button"
      class="min-h-11 rounded-lg px-4 text-slate-700 underline"
      onclick={oncancel}>{error ? "Close" : "Cancel"}</button
    >
    {#if !error}
      <button
        type="button"
        class="inline-flex min-h-11 items-center gap-2 rounded-lg bg-blue-600 px-5 font-semibold text-white disabled:opacity-60"
        disabled={!ready}
        onclick={capture}
      >
        <Icon name="camera" class="size-5" />
        Take photo
      </button>
    {/if}
  </div>
</div>
