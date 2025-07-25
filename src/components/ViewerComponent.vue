<!--
  - SPDX-FileCopyrightText: 2019 Nextcloud GmbH and Nextcloud contributors
  - SPDX-License-Identifier: AGPL-3.0-or-later
-->

<template>
	<Editor
		v-if="!useSourceView"
		:file-id="fileid"
		:relative-path="filename"
		:active="active || isEmbedded"
		:autofocus="autofocus"
		:share-token="shareToken"
		:class="{ 'text-editor--embedding': isEmbedded }"
		:mime="mime"
		:show-outline-outside="showOutlineOutside" />
	<div
		v-else
		id="editor-container"
		data-text-el="editor-container"
		class="text-editor source-viewer">
		<Component
			:is="readerComponent"
			:content="content"
			:file-id="fileid"
			:read-only="true"
			:show-menu-bar="false" />
		<NcButton v-if="isEmbedded" class="toggle-interactive" @click="toggleEdit">
			{{ t('text', 'Edit') }}
			<template #icon>
				<PencilOutlineIcon />
			</template>
		</NcButton>
	</div>
</template>

<script>
import axios from '@nextcloud/axios'
import { getClient, getRootPath } from '@nextcloud/files/dav'
import { t } from '@nextcloud/l10n'
import { getSharingToken } from '@nextcloud/sharing/public'
import NcButton from '@nextcloud/vue/dist/Components/NcButton.js'
import Vue from 'vue'
import PencilOutlineIcon from 'vue-material-design-icons/PencilOutline.vue'
import MarkdownContentEditor from './Editor/MarkdownContentEditor.vue'
import PlainTextReader from './PlainTextReader.vue'

import getEditorInstance from './Editor.singleton.js'

export default {
	name: 'ViewerComponent',
	components: {
		NcButton: Vue.extend(NcButton),
		PencilOutlineIcon: Vue.extend(PencilOutlineIcon),
		PlainTextReader: Vue.extend(PlainTextReader),
		MarkdownContentEditor: Vue.extend(MarkdownContentEditor),
		Editor: getEditorInstance,
	},
	provide() {
		return {
			isEmbedded: this.isEmbedded,
		}
	},
	props: {
		filename: {
			type: String,
			default: null,
		},
		fileid: {
			type: Number,
			default: null,
		},
		active: {
			type: Boolean,
			default: false,
		},
		autofocus: {
			type: Boolean,
			default: true,
		},
		shareToken: {
			type: String,
			default: () => getSharingToken(),
		},
		mime: {
			type: String,
			default: null,
		},
		showOutlineOutside: {
			type: Boolean,
			default: false,
		},
		permissions: {
			type: String,
			default: '',
		},
		source: {
			type: String,
			default: undefined,
		},
		isEmbedded: {
			type: Boolean,
			default: false,
		},
	},
	data() {
		return {
			content: '',
			hasToggledInteractiveEmbedding: false,
		}
	},
	computed: {
		/** @return {boolean} */
		useSourceView() {
			return (
				this.source
				&& (this.fileVersion
					|| !this.fileid
					|| this.isEmbedded
					|| this.isEncrypted)
				&& !this.hasToggledInteractiveEmbedding
			)
		},

		isEncrypted() {
			return this.$attrs.e2EeIsEncrypted || false
		},

		isMarkdown() {
			return (
				this.mime === 'text/markdown' || this.mime === 'text/x-web-markdown'
			)
		},

		/** @return {boolean} */
		readerComponent() {
			return this.isMarkdown ? MarkdownContentEditor : PlainTextReader
		},
	},

	watch: {
		source() {
			this.loadFileContent()
		},
	},

	mounted() {
		this.loadFileContent()
	},

	methods: {
		async loadFileContent() {
			if (this.useSourceView) {
				if (this.isEncrypted) {
					this.content = await this.fetchDecryptedContent()
					this.contentLoaded = true
				} else {
					const response = await axios.get(this.source)
					this.content = response.data
					this.contentLoaded = true
				}
			}
			this.$emit('update:loaded', true)
		},
		toggleEdit() {
			this.hasToggledInteractiveEmbedding = true
		},
		async fetchDecryptedContent() {
			const client = getClient()
			const response = await client.getFileContents(
				`${getRootPath()}${this.filename}`,
				{ details: true },
			)
			const blob = new Blob([response.data], {
				type: response.headers['content-type'],
			})
			const reader = new FileReader()
			reader.readAsText(blob)
			return new Promise((resolve) => {
				reader.onload = () => {
					resolve(reader.result)
				}
			})
		},
		t,
	},
}
</script>
<style lang="scss" scoped>
.text-editor:not(.viewer__file--hidden) {
	top: 0;
	width: 100%;
	max-width: 100%;
	height: 100%;
	left: 0;
	margin: 0 auto;
	position: relative;
	background-color: var(--color-main-background);

	&.source-viewer {
		display: block;

		.text-editor__content-wrapper {
			margin-top: var(--header-height);
		}

		.toggle-interactive {
			position: sticky;
			bottom: 0;
			right: 0;
			z-index: 1;
			margin-left: auto;
			margin-right: 0;
		}
	}

	&.text-editor--embedding {
		min-height: 400px;
	}
}
</style>
<style lang="scss">
@import './../css/variables';
@media only screen and (max-width: 512px) {
	// on mobile, modal-container has top: 50px
	.text-editor {
		top: auto;
	}
}

body .toastify.dialogs {
	// Move the dialogs below the toolbar / status
	margin-top: calc(45px + var(--default-clickable-area));
}

.viewer[data-handler='text'] .modal-wrapper .modal-container {
	bottom: 0;
}
</style>
