const h = require('mutant/html-element')
const computed = require('mutant/computed')
const humanTime = require('human-time')
const WatchHeads = require('tre-watch-heads')
const {diff} = require('json8-patch')

module.exports = function EditorShell(ssb, opts) {
  opts = opts || {}
  const watchHeads = WatchHeads(ssb)

  function externalChanges(current_kvm, kv) {
    return computed(current_kvm, kvm => {
      if (!kvm) return h('span', 'Nothing loaded into editor')
      if (kvm.key == kv.key) return h('span', '(based on head)')
      const author = kvm.value.author
      const time = humanTime(new Date(kvm.value.timestamp))
      const operations = diff(kv.value.content, kvm.value.content) 
      return [
        h('span.warning', `${author.substr(0, 8)} has published an update ${time}`),
        h('ul.operations', operations.map(renderOperation))
      ]
    })
  }

  function localChanges(contentObs, kv) {
    const original = kv.value.content
    return computed(contentObs, edited => {
      const operations = diff(original, edited) 
      if (operations.length == 0) return []
      return h('div.local-changes', [
        h('span', 'Your changes'),
        h('ul.operations', operations.map(renderOperation))
      ])
    })
  }

  function renderOperation(o) {
    const {op, path, value} = o
    return h('li', [
      h('span.op', op),
      h('span.path', path),
      h('span.value', value)
    ])
  }
  
  return function renderEditorShell(kv, ctx) {
    ctx = ctx || {}
    const revRoot = revisionRoot(kv)
    if (!revRoot) return
    const {renderEditor} = ctx
    const {contentObs} = ctx || Value(kv.value && kv.value.content || {})
    ctx.contentObs = contentObs

    // kvm = "key, value, meta"
    console.log('watching', revRoot)
    const current_kvm = watchHeads(revRoot)
    return h('div.tre-editor-shell', [
      externalChanges(current_kvm, kv),
      localChanges(contentObs, kv),
      renderEditor(kv, ctx)
    ])
  }
}

function revisionRoot(kv) {
  return kv && kv.value.content && kv.value.content.revisionRoot || kv.key
}
