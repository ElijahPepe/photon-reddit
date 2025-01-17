import ViewsStack from "../../../historyState/viewsStack.js";
import { HistoryState, RedditApiType } from "../../../types/misc.js";
import { hasParams } from "../../../utils/utils.js";
import Ph_Post from "../../post/post.js";
import PostDoubleLink from "../../post/postDoubleLink/postDoubleLink.js";
import Ph_PostAndComments from "../../postAndComments/postAndComments.js";
import { Ph_ViewState } from "../viewState.js";

/**
 * A Ph_ViewState with a loading screen
 */
export default class Ph_CommentsViewStateLoader extends Ph_ViewState {
	post: Ph_Post
	postAndComments: Ph_PostAndComments;
	isReadyForCleanup = false;

	constructor(state: HistoryState, postHint: PostDoubleLink) {
		super(state);
		if (!hasParams(arguments)) return;

		this.addEventListener("click", this.onBackAreaClick);
		this.post = postHint.post;
		this.postAndComments = new Ph_PostAndComments(null,{
			post: postHint.post,
			subredditPrefixed: postHint.postSubredditPrefixed,
			userPrefixed: postHint.postUserPrefixed
		});
		this.appendChild(this.postAndComments);
	}

	finishWith(postAndCommentsData: RedditApiType[]) {
		this.postAndComments.initWithData(postAndCommentsData);
	}

	error() {
		this.innerHTML = `
			<div>
				<h2>Oh no an error occurred!</h2>
				<div>What could have happened?</div>
				<ul>
					<li>The page you tried to visit was deleted or isn't publicly visible.</li>
					<li>You entered an invalid Url.</li>
					<li>Reddit is having problems. Check <a href="https://www.redditstatus.com" target="_blank">redditstatus.com</a></li>
					<li>If you are using firefox, you might have to disable "Enhanced Tracking Protection".</li>
					<li>Some internal error occurred. Check the browser console logs.</li>
				</ul>
			</div>
		`;
	}

	onBackAreaClick(e: MouseEvent) {
		if (e.currentTarget !== e.target || !ViewsStack.hasPreviousLoaded())
			return;

		history.back();
	}

	/** Ownership by PostDoubleLink; only if post and viewState are removed, start cleanup */
	onRemoved() {
		if (!this.isReadyForCleanup)
			return;
		super.onRemoved();
	}

	connectedCallback() {
		super.connectedCallback();

		this.setIsNotReadyForCleanup()
	}

	setIsReadyForCleanup() {
		if (this.isConnected)
			this.isReadyForCleanup = true;
		else
			super.onRemoved();
	}

	setIsNotReadyForCleanup() {
		this.isReadyForCleanup = false;
	}
}

customElements.define("ph-comments-view-state-loader", Ph_CommentsViewStateLoader);
