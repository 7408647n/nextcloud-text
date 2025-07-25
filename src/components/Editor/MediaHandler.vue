<!--
  - SPDX-FileCopyrightText: 2022 Nextcloud GmbH and Nextcloud contributors
  - SPDX-License-Identifier: AGPL-3.0-or-later
-->

<template>
	<div
		class="editor editor-media-handler"
		data-text-el="editor-media-handler"
		:class="{ draggedOver, 'is-mobile': isMobile }"
		@image-paste="onPaste"
		@dragover.prevent.stop="setDraggedOver(true)"
		@dragleave.prevent.stop="setDraggedOver(false)"
		@drop.prevent.stop="setDraggedOver(false)"
		@file-drop="onEditorDrop">
		<input
			v-show="false"
			ref="attachmentFileInput"
			data-text-el="attachment-file-input"
			type="file"
			accept="*/*"
			multiple
			@change="onAttachmentUploadFilePicked" />
		<slot />
	</div>
</template>

<script>
import { getCurrentUser } from '@nextcloud/auth'
import { showError } from '@nextcloud/dialogs'
import { emit } from '@nextcloud/event-bus'
import { generateUrl } from '@nextcloud/router'
import { useIsMobile } from '@nextcloud/vue/composables/useIsMobile'
import {
	createAttachment,
	insertAttachmentFile,
	uploadAttachment,
} from '../../apis/attach.ts'
import { logger } from '../../helpers/logger.js'

import { useEditor } from '../../composables/useEditor.ts'
import { useFileMixin } from '../Editor.provider.ts'

import { useConnection } from '../../composables/useConnection.ts'
import {
	ACTION_ATTACHMENT_PROMPT,
	ACTION_CHOOSE_LOCAL_ATTACHMENT,
	ACTION_CREATE_ATTACHMENT,
	STATE_UPLOADING,
} from './MediaHandler.provider.js'

const getDir = (val) => val.split('/').slice(0, -1).join('/')

export default {
	name: 'MediaHandler',
	mixins: [useFileMixin],
	provide() {
		const val = {}

		Object.defineProperties(val, {
			[ACTION_ATTACHMENT_PROMPT]: {
				get: () => this.showAttachmentPrompt,
			},
			[ACTION_CHOOSE_LOCAL_ATTACHMENT]: {
				get: () => this.chooseLocalFile,
			},
			[ACTION_CREATE_ATTACHMENT]: {
				get: () => this.createAttachment,
			},
			[STATE_UPLOADING]: {
				get: () => this.state,
			},
		})

		return val
	},
	setup() {
		const { connection } = useConnection()
		const isMobile = useIsMobile()
		const { editor } = useEditor()
		return {
			connection,
			editor,
			isMobile,
		}
	},
	data() {
		return {
			lastFilePath: null,
			draggedOver: false,
			// make it reactive to be used inject/provide
			state: {
				isUploadingAttachments: false,
			},
		}
	},
	computed: {
		initialFilePath() {
			return this.lastFilePath ?? getDir(this.$file?.relativePath ?? '/')
		},
	},
	methods: {
		setDraggedOver(val) {
			this.draggedOver = val
		},
		onPaste(e) {
			this.uploadAttachmentFiles(e.detail.files)
		},
		onEditorDrop(e) {
			this.uploadAttachmentFiles(e.detail.files, e.detail.position)
		},
		onAttachmentUploadFilePicked(event) {
			this.uploadAttachmentFiles(event.target.files)
			// Clear input to ensure that the change event will be emitted if
			// the same file is picked again.
			event.target.value = ''
		},
		chooseLocalFile() {
			this.$refs.attachmentFileInput.click()
		},
		async uploadAttachmentFiles(files, position = null) {
			if (!files) {
				return
			}

			this.state.isUploadingAttachments = true

			const uploadPromises = [...files].map((file) => {
				return this.uploadAttachmentFile(file, position)
			})

			return Promise.all(uploadPromises)
				.catch((error) => {
					logger.error('Uploading multiple attachments failed', { error })
					showError(t('text', 'Uploading multiple attachments failed.'))
				})
				.then(() => {
					this.state.isUploadingAttachments = false
				})
		},
		async uploadAttachmentFile(file, position = null) {
			this.state.isUploadingAttachments = true

			return uploadAttachment(this.connection, file)
				.then((response) => {
					this.insertAttachment(
						response.data?.name,
						response.data?.id,
						file.type,
						position,
						response.data?.dirname,
					)
				})
				.catch((error) => {
					logger.error('Uploading attachment failed', { error })
					if (error.response?.data.error) {
						showError(
							t('text', 'Uploading attachment failed: {error}', {
								error: error.response.data.error,
							}),
						)
					} else {
						showError(t('text', 'Uploading attachment failed.'))
					}
				})
				.then(() => {
					this.state.isUploadingAttachments = false
				})
		},
		showAttachmentPrompt() {
			const currentUser = getCurrentUser()
			if (!currentUser) {
				return
			}

			OC.dialogs.filepicker(
				t('text', 'Insert an attachment'),
				(filePath) => {
					this.insertFromPath(filePath)
				},
				false,
				[],
				true,
				undefined,
				this.initialFilePath,
			)
		},
		insertFromPath(filePath) {
			this.lastFilePath = getDir(filePath)

			this.state.isUploadingAttachments = true

			return insertAttachmentFile(this.connection, filePath)
				.then((response) => {
					this.insertAttachment(
						response.data?.name,
						response.data?.id,
						response.data?.mimetype,
						null,
						response.data?.dirname,
					)
				})
				.catch((error) => {
					logger.error('Failed to insert from Files', { error })
					showError(t('text', 'Failed to insert from Files'))
				})
				.then(() => {
					this.state.isUploadingAttachments = false
				})
		},
		createAttachment(template) {
			this.state.isUploadingAttachments = true
			return createAttachment(this.connection, template)
				.then((response) => {
					this.insertAttachmentPreview(response.data?.id)
				})
				.catch((error) => {
					logger.error('Failed to create attachment', { error })
					showError(t('text', 'Failed to create attachment'))
				})
				.then(() => {
					this.state.isUploadingAttachments = false
				})
		},
		insertAttachmentPreview(fileId) {
			const url = new URL(generateUrl(`/f/${fileId}`), window.origin)
			const href = url.href.replaceAll(' ', '%20')
			this.editor.chain().focus().insertPreview(href).run()
		},
		insertAttachment(name, fileId, mimeType, position = null, dirname = '') {
			// inspired by the fixedEncodeURIComponent function suggested in
			// https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/encodeURIComponent
			const src =
				dirname
				+ '/'
				+ encodeURIComponent(name).replace(/[!'()*]/g, (c) => {
					return '%' + c.charCodeAt(0).toString(16).toUpperCase()
				})
			// simply get rid of brackets to make sure link text is valid
			// as it does not need to be unique and matching the real file name
			const alt = name.replaceAll(/[[\]]/g, '')

			const chain = position
				? this.editor.chain().focus(position)
				: this.editor.chain()

			chain.setImage({ src, alt }).run()

			const selection = this.editor.view.state.selection
			if (!selection.empty) {
				// If inserted image is first element, it is selected and would get overwritten by
				// subsequent editor inserts (see tiptap#3355). So unselect the image by placing
				// the cursor at the end of the selection.
				this.editor.commands.focus(selection.to)
			}

			// Scroll image into view
			this.editor.commands.scrollIntoView()

			// Store last inserted attachment src to focus it in ImageView.vue
			this.editor.commands.setMeta('insertedAttachmentSrc', { src })

			emit('text:image-node:add', null)
		},
	},
}
</script>
