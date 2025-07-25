/**
 * SPDX-FileCopyrightText: 2024 Nextcloud GmbH and Nextcloud contributors
 * SPDX-License-Identifier: AGPL-3.0-or-later
 */

import { schema } from '@tiptap/pm/schema-basic'
import { EditorState, Plugin } from '@tiptap/pm/state'
import { hideLinkBubble, linkBubble, setActiveLink } from '../../plugins/links.js'

describe('linkBubble prosemirror plugin', () => {
	test('signature', () => {
		expect(linkBubble).toBeInstanceOf(Function)
		expect(linkBubble()).toBeInstanceOf(Plugin)
	})

	test('usage as plugin', () => {
		const plugin = linkBubble()
		const state = createState({ plugins: [plugin] })
		expect(state.plugins).toContain(plugin)
		expect(plugin.getState(state)).toEqual({ active: null })
	})

	test('updates plugin state active on transaction', () => {
		const plugin = linkBubble()
		const state = createState({ plugins: [plugin] })
		const dummy = { was: 'active' }
		const tr = state.tr.setMeta(plugin, { active: dummy })
		const after = state.apply(tr)
		expect(plugin.getState(after)).toEqual({ active: dummy })
	})

	test('setActiveLink requires a link mark', () => {
		const noMarks = { marks: () => [] }
		expect(setActiveLink(noMarks)(null, null)).toBe(false)
		const otherMark = { marks: () => [{ type: { name: 'other' } }] }
		expect(setActiveLink(otherMark)(null, null)).toBe(false)
		const mark = { marks: () => [{ type: { name: 'link' } }] }
		expect(setActiveLink(mark)(null, null)).toBe(true)
	})

	test('setActiveLink extracts the link mark', () => {
		const plugin = linkBubble()
		const state = createState({ plugins: [plugin] })
		const flow = createFlow(state)
		const mark = { type: { name: 'link' } }
		const resolved = { marks: () => [mark] }
		setActiveLink(resolved)(flow.state, flow.dispatch)
		expect(plugin.getState(flow.state).active.mark).toEqual(mark)
	})

	test('hideLinkBubble requires an active menu bubble', () => {
		const plugin = linkBubble()
		const state = createState({ plugins: [plugin] })
		expect(hideLinkBubble(state, null)).toBe(false)
	})

	test('hideLinkBubble clears the active state', () => {
		const plugin = linkBubble()
		const state = createState({ plugins: [plugin] })
		const flow = createFlow(state)
		const mark = { type: { name: 'link' } }
		const resolved = { marks: () => [mark] }
		setActiveLink(resolved)(flow.state, flow.dispatch)
		hideLinkBubble(flow.state, flow.dispatch)
		expect(plugin.getState(flow.state).active).toEqual(null)
	})
})

// simulate the data flow in prosemirror
const createFlow = (initialState) => {
	let state = initialState
	return {
		get state() {
			return state
		},
		dispatch: (tr) => {
			state = state.apply(tr)
		},
	}
}

const createState = (options = {}) => {
	return EditorState.create({
		schema,
		...options,
	})
}
