import { hasParams, urlWithHttps } from "../../../../utils/utils.js";
import Ph_VideoWrapper, { BasicVideoData, SourceData, VideoTrackInfo } from "../videoWrapper.js";

/**
 * A video wrapper for gifs. Very limited compared to videos (not time information, no seeking, no pause only stop).
 *
 * Pausing works by replacing the gif <img> with a <canvas>
 */
export default class Ph_GifVideo extends Ph_VideoWrapper {
	gifSrc: string;
	gifImg: HTMLImageElement;
	canvasWrapper: HTMLDivElement;
	gifCanvas: HTMLCanvasElement;

	constructor(src: string) {
		super();
		if (!hasParams(arguments)) return;

		src = urlWithHttps(src);

		this.classList.add("gifVideo");
		this.gifSrc = src;

		this.gifImg = document.createElement("img");
		this.gifImg.alt = src;
		this.gifImg.src = src;
		this.gifImg.draggable = false;
		this.append(this.gifImg);
		this.gifImg.addEventListener("load", () => {
			this.gifCanvas.width = this.gifImg.naturalWidth;
			this.gifCanvas.height = this.gifImg.naturalHeight;
			this.gifCanvas.getContext("2d").drawImage(this.gifImg, 0, 0, this.gifCanvas.width, this.gifCanvas.height);
			this.pause();
			this.dispatchEvent(new Event("ph-ready"));
		}, { once: true });
		this.gifImg.addEventListener("dragstart", e => {
			e.preventDefault();
			return false;
		});

		this.canvasWrapper = document.createElement("div");
		this.append(this.canvasWrapper);
		this.gifCanvas = document.createElement("canvas");
		this.canvasWrapper.append(this.gifCanvas);

		setTimeout(() => this.dispatchEvent(new Event("ph-no-audio")), 0);
	}

	getCurrentTime(): number {
		return 0;
	}

	getDimensions(): number[] {
		return [this.gifImg.naturalWidth, this.gifImg.naturalHeight];
	}

	getMaxTime(): number {
		return 0;
	}

	getVolume(): number {
		return 0;
	}

	pause(): void {
		this.canvasWrapper.classList.remove("hide");
		this.gifImg.classList.add("remove");
		this.dispatchEvent(new Event("ph-pause"));
	}

	play(): void {
		this.gifImg.src = "";
		this.gifImg.src = this.gifSrc;
		this.canvasWrapper.classList.add("hide");
		this.gifImg.classList.remove("remove");
		this.dispatchEvent(new Event("ph-play"));
		this.dispatchEvent(new Event("ph-playing"));
	}

	seekTo(time: number): void {
	}

	setPlaybackSpeed(speed: number): void {
	}

	setVolume(vol: number): void {
	}

	toggleMute(): boolean {
		return false;
	}

	setIsMuted(): boolean {
		return true;
	}

	togglePlay(): void {
		if (this.canvasWrapper.classList.contains("hide"))
			this.pause();
		else
			this.play();
	}

	getUrl(): string {
		return this.gifSrc;
	}

	exportData(): BasicVideoData {
		return {
			className: "Ph_GifVideo",
			data: this.gifSrc
		};
	}

	getVideoTracks(): VideoTrackInfo[] {
		return [];
	}

	setVideoTrack(key: SourceData) {
	}

	getCurrentTrack(): VideoTrackInfo {
		return null;
	}
}

customElements.define("ph-gif-video", Ph_GifVideo);
