/**
 * name-suggest 事件解析
 * 运行: node miniprogram/utils/name-suggest-event.test.js
 */
const assert = require('assert')
const { resolveNameSuggestValue } = require('./name-suggest-event')

assert.strictEqual(resolveNameSuggestValue(undefined), null)
assert.strictEqual(resolveNameSuggestValue(null), null)
assert.strictEqual(resolveNameSuggestValue('乔姐'), null)
assert.strictEqual(resolveNameSuggestValue({}), null)
assert.strictEqual(resolveNameSuggestValue({ name: '乔姐' }), null)
assert.strictEqual(resolveNameSuggestValue({ value: null }), null)
assert.strictEqual(resolveNameSuggestValue({ value: undefined }), null)

assert.strictEqual(resolveNameSuggestValue({ value: '乔姐' }), '乔姐')
assert.strictEqual(resolveNameSuggestValue({ value: '' }), '')
assert.strictEqual(resolveNameSuggestValue({ value: 12 }), '12')

console.log('name-suggest-event tests passed')
