import { redditApiRequest } from "../../../api/api.js";
import { elementWithClassInTree } from "../../../utils/htmlStuff.js";
import { RedditApiType } from "../../../utils/types.js";
import { throttle } from "../../../utils/utils.js";
import Ph_Comment from "../../comment/comment.js";
import Ph_Toast, { Level } from "../../misc/toast/toast.js";
import Post from "../../post/post.js";
import { Ph_ViewState } from "../../viewState/viewState.js";
import Ph_FeedInfo from "../feedInfo/feedInfo.js";
import Ph_SearchFeedSorter from "../sorting/searchFeedSorter.js";
import Ph_UniversalFeedSorter from "../sorting/universalFeedSorter.js";

export enum FeedType {
	subreddit,
	multireddit,
	user,
	misc,
}

export default class Ph_UniversalFeed extends HTMLElement {
	absoluteFirst: string = null;
	beforeData: string = null;
	afterData: string = null;
	isLoading: boolean = false;
	requestUrl: string;
	hasReachedEndOfFeed = false;
	isSearchFeed = false;

	constructor(posts: RedditApiType, requestUrl: string) {
		super();

		this.beforeData = posts.data.before;
		this.afterData = posts.data.after;
		if (this.afterData === null)
			this.hasReachedEndOfFeed = true;
		this.requestUrl = requestUrl;

		//wait for this element to be attached to a parent
		setTimeout(() => {
			let scrollElement = this.parentElement;
			while (!scrollElement.classList.contains("overflow-y-auto"))
				scrollElement = this.parentElement;

			scrollElement.addEventListener("scroll", throttle(this.onScroll.bind(this), 500), { passive: true });
		}, 0);

		// find first FeedItem, once it has been added
		const observer = new MutationObserver((mutationsList: MutationRecord[], observer) => {
			for (const mutation of mutationsList) {
				for (const addedNode of mutation.addedNodes) {
					if (addedNode["itemId"]) {
						this.absoluteFirst = addedNode["itemId"];
						observer.disconnect();
						return;
					}
				}
			}
		});
		observer.observe(this, { childList: true });

		this.classList.add("universalFeed");
		if (/\/search\/?(\?.*)?$/.test(requestUrl))
			this.isSearchFeed = true;

		// make feed specific header elements
		setTimeout(() => {
			const headerElements = [];
			const title = document.createElement("div");
			title.className = "feedTitle";
			let feedType: FeedType;
			let feedBaseUrl: string;
			if (/^\/?(\?.*)?$/.test(requestUrl)) {									// home
				title.innerText = "Home";
				feedType = FeedType.misc;
			}
			else if (/^\/r\/[^/]+/.test(requestUrl)) {								// subreddit
				title.innerText = requestUrl.match(/r\/[^/]+/)[0];
				feedType = FeedType.subreddit;
				feedBaseUrl = requestUrl.match(/\/r\/[^/]+/)[0];
			}
			else if (/^\/(u|user)\/[^/]+\/m\/[^/]+/.test(requestUrl)) {				// multi
				title.innerText = "Multireddit " + requestUrl.match(/\/m\/([^/]+)/)[1];
				feedType = FeedType.multireddit;
				const matches = requestUrl.match(/\/(u|user)\/([^/]+)\/m\/([^/]+)/)
				feedBaseUrl = `/user/${matches[2]}/m/${matches[3]}`;
			}
			else if (/^\/(u|user)\/[^/]+/.test(requestUrl)) {						// user
				title.innerText = "u/" + requestUrl.match(/\/(u|user)\/([^/]+)/)[2];
				feedType = FeedType.user;
				feedBaseUrl = "/user/" + requestUrl.match(/\/(u|user)\/([^/]+)/)[2];
			}
			else {
				new Ph_Toast(Level.Error, `Unknown feed for ${requestUrl}`)
				console.error(`Unknown feed for ${requestUrl}`);
				title.innerText = `Unknown feed for ${requestUrl}`;
				feedType = FeedType.misc;
			}
			headerElements.push(title);
			if (feedType !== FeedType.misc)
				headerElements.push(new Ph_FeedInfo(feedType, feedBaseUrl).makeShowInfoButton());
			if (this.isSearchFeed)
				headerElements.push(new Ph_SearchFeedSorter(this));
			else
				headerElements.push(new Ph_UniversalFeedSorter(this));
			(elementWithClassInTree(this.parentElement, "viewState") as Ph_ViewState).setHeaderElements(headerElements);
		}, 0);


		for (const postData of posts.data.children) {
			try {
				this.appendChild(this.makeFeedItem(postData));
			}
			catch (e) {
				console.error(e);
				new Ph_Toast(Level.Error, `Error making feed item`);
			}
		}
	}

	makeFeedItem(itemData: RedditApiType): HTMLElement {
		switch (itemData.kind) {
			case "t3":
				return new Post(itemData, true);
			case "t1":
				return new Ph_Comment(itemData, false, true, null);
			default:
				new Ph_Toast(Level.Error, `Unknown feed item "${itemData.kind}"`);
				throw `What is this feed item? ${JSON.stringify(itemData, null, 4)}`;
		}
	}

	/**
	 * If less than 5 screen heights are left until the end of the feed, load new content
	 *
	 * @param e
	 */
	onScroll(e) {
		// stop if empty or is loading or for some reason close to empty (normal feed will have very large scrollHeight)
		if (this.children.length <= 0 || this.isLoading || this.scrollHeight < window.innerHeight)
			return;
		const last = this.children[this.childElementCount - 1];
		if (last.getBoundingClientRect().y < window.innerHeight * 2.5 && !this.hasReachedEndOfFeed)
			this.scrollAction(LoadPosition.After)
		const first = this.children[0];
		if (first && first.getBoundingClientRect().y > window.innerHeight * -2.5)
			this.scrollAction(LoadPosition.Before);
	}

	scrollAction(loadPosition: LoadPosition) {
		if (loadPosition === LoadPosition.Before && (this.beforeData === null || this.beforeData === this.absoluteFirst))
			return;

		this.isLoading = true;
		this.loadMore(loadPosition)
			.then(() => {
				this.clearPrevious(loadPosition);
				this.isLoading = false;
			})
			.catch(() => this.isLoading = false);
	}

	clearPrevious(loadPosition: LoadPosition) {
		if (loadPosition === LoadPosition.Before) {
			let last = this.children[this.childElementCount - 1];
			while (last && last.getBoundingClientRect().y > window.innerHeight * 12) {
				last.remove();
				last = this.children[this.childElementCount - 1];
			}
			this.afterData = last["itemId"]
		}
		else if (loadPosition === LoadPosition.After) {
			let first = this.children[0];
			while (first && first.getBoundingClientRect().y < window.innerHeight * -12) {
				first.remove();
				first = this.children[0];
			}
			this.beforeData = first["itemId"];
		}
	}

	async loadMore(loadPosition) {
		const posts: RedditApiType = await redditApiRequest(this.requestUrl, [
			["before", loadPosition === LoadPosition.Before ? this.beforeData : "null"],
			["after",  loadPosition === LoadPosition.After  ? this.afterData : "null"],
		], false);

		if (loadPosition === LoadPosition.After) {
			for (const postData of posts.data.children) {
				try {
					this.appendChild(this.makeFeedItem(postData));
				}
				catch (e) {
					console.error(e);
					new Ph_Toast(Level.Error, `Error making feed item`);
				}
			}
			this.afterData = this.children[this.childElementCount - 1]["itemId"];
			if (this.afterData === null)
				this.hasReachedEndOfFeed = true;
		}
		else {
			for (const postData of posts.data.children.reverse()) {
				try {
					const newPost = this.makeFeedItem(postData);
					this.insertAdjacentElement("afterbegin", newPost);
				}
				catch (e) {
					console.error(e);
					new Ph_Toast(Level.Error, `Error making feed item`);
				}
			}

			this.beforeData = this.children[1]["itemId"];
		}
	}

	replaceChildren(posts: RedditApiType[]) {
		this.innerText = "";

		for (const item of posts) {
			try {
				this.appendChild(this.makeFeedItem(item));
			}
			catch (e) {
				console.error(e);
				new Ph_Toast(Level.Error, `Error making feed item`);
			}
		}
	}
}

enum LoadPosition {
	Before, After
}

customElements.define("ph-universal-feed", Ph_UniversalFeed);
