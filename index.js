const h = require('mutant/html-element')
const computed = require('mutant/computed')
const humanTime = require('human-time')
const WatchHeads = require('tre-watch-heads')

module.exports = function EditorShell(ssb, opts) {
  opts = opts || {}
  const watchHeads = WatchHeads(ssb)

  return function renderEditorShell(kv, ctx) {
    ctx = ctx || {}
    const revRoot = revisionRoot(kv)
    if (!revRoot) return

    // kvm = "key, value, meta"
    console.log('watching', revRoot)
    const current_kvm = watchHeads(revRoot)
    return h('div.tre-editor-shell', [
      computed(current_kvm, kvm => {
        console.log('current_kvm', kvm)
        if (!kvm) return h('span', 'Nothing loaded into editor')
        if (kvm.key == kv.key) return h('span', '(no conflict)')
        const author = kvm.value.author
        const time = humanTime(new Date(kvm.value.timestamp))
        return h('span.warning', `${author.substr(0, 8)} has published an update ${time}`)
      })
    ])
  }
}

function revisionRoot(kv) {
  return kv && kv.value.content && kv.value.content.revisionRoot || kv.key
}
