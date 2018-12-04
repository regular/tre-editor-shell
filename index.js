const h = require('mutant/html-element')
const computed = require('mutant/computed')
const Value = require('mutant/value')
const humanTime = require('human-time')
const History = require('tre-revision-history')
const {diff, apply} = require('json8-patch')

module.exports = function EditorShell(ssb, opts) {
  opts = opts || {}
  const history = History(ssb)

  function externalChanges(revRoot, baseObs, contentObs) {
    const revisionsObs = history(revRoot)

    return computed( [revisionsObs, baseObs, contentObs], (revisions, base_kv, content) => {

      if (!base_kv) return h('span', 'No base')

      revisions = revisions.slice().reverse()
      if (!revisions.length) return h('span', 'No revisions')
      if (revisions[0].key == base_kv.key) return h('span', '(based on head)')

      const baseIndex = revisions.findIndex( r => r.key == base_kv.key)
      
      const changeSet = revisions.slice(0, baseIndex)
      return changeSet.map( rev => { 
        const author = rev.value.author
        const time = humanTime(new Date(rev.value.timestamp))
        const newRevDiff = diff(base_kv.value.content, rev.value.content) 
        const todo = diff(content, rev.value.content).filter( ({path}) => {
          // if there's no overlap in paths of operations(base -> head) and (editor -> head)
          // we don't put the operation in the todo list. (there's no conflict)
          let conflict = false
          newRevDiff.forEach( op => {
            if (op.path.startsWith(path) || path.startsWith(op.path)) conflict = true
          })
          return conflict
        })
        return [
          h('div.new-revision', [
            `${author.substr(0, 8)} has published an update ${time}`,
            h('ul.operations', newRevDiff.map(renderOperation))
          ]),
          h('div.diff-to-new-revision', [
            todo.length ? [
              `To merge these changes`,
              h('ul.operations', todo.map(o => renderOperation(o, {applyButton: true, contentObs})))
            ] : rev == changeSet.slice(-1)[0] ? [
              h('button', {
                'ev-click': e => {
                  baseObs.set(rev)
                }
              }, 'Rebase')
            ] : []
          ])
        ]
      })
    })
  }

  function localChanges(contentObs, baseObs) {
    return computed([contentObs, baseObs], (edited, base_kv) => {
      const original = base_kv.value.content
      const operations = diff(original, edited) 
      if (operations.length == 0) return []
      return h('div.local-changes', [
        h('span', 'Your changes'),
        h('ul.operations', operations.map(renderOperation))
      ])
    })
  }

  function applyPatch(patch, contentObs) {
    let c = contentObs()
    c = apply(c, patch).doc
    contentObs.set(c)
  }

  function renderOperation(o, opts) {
    opts = opts || {}
    const {op, path, value, from} = o
    return h(`li.${op}`, [
      h('span.op', op),
      h('span.path', path),
      h('span.value', value),
      h('span.from', from),
      opts.applyButton ? h('button', {
        'ev-click': e => {
          setTimeout( () => applyPatch([o], opts.contentObs), 0)
        }
      }, 'Apply') : []
    ])
  }
  
  return function renderEditorShell(kv, ctx) {
    ctx = ctx || {}
    const revRoot = revisionRoot(kv)
    if (!revRoot) return
    const {renderEditor} = ctx
    const contentObs = ctx.contentObs || Value(kv.value && kv.value.content || {})
    ctx.contentObs = contentObs
    const baseObs = ctx.baseObs || Value(kv)
    ctx.baseObs = baseObs

    let external = externalChanges(revRoot, baseObs, contentObs)
    return h('div.tre-editor-shell', {
      hooks: [el => external.abort]
    }, [
      external,
      renderEditor(kv, ctx),
      localChanges(contentObs, baseObs),
    ])
  }
}

function revisionRoot(kv) {
  return kv && kv.value.content && kv.value.content.revisionRoot || kv.key
}
