/**
 * SPDX-FileCopyrightText: 2022 Nextcloud GmbH and Nextcloud contributors
 * SPDX-License-Identifier: AGPL-3.0-or-later
 */

import { VueNodeViewRenderer } from '@tiptap/vue-2'
import Table from './Table/Table.js'
import TableCaption from './Table/TableCaption.js'
import TableCell from './Table/TableCell.js'
import TableCellView from './Table/TableCellView.vue'
import TableHeader from './Table/TableHeader.js'
import TableHeaderView from './Table/TableHeaderView.vue'
import TableHeadRow from './Table/TableHeadRow.js'
import TableRow from './Table/TableRow.js'
import TableView from './Table/TableView.vue'

/**
 *
 * @param {object} node - the node to add the view to.
 * @param {object} view - the node view to add to the node.
 */
function extendNodeWithView(node, view) {
	return node.extend({
		addNodeView() {
			return VueNodeViewRenderer(view)
		},
	})
}

export default Table.extend({
	addNodeView() {
		return VueNodeViewRenderer(TableView)
	},

	addExtensions() {
		return [
			TableCaption,
			extendNodeWithView(TableCell, TableCellView),
			extendNodeWithView(TableHeader, TableHeaderView),
			TableHeadRow,
			TableRow,
		]
	},
})
