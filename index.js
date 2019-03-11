const h = require('mutant/html-element')
const computed = require('mutant/computed')
const Value = require('mutant/value')
const watch = require('mutant/watch')
const humanTime = require('human-time')
const History = require('tre-revision-history')
const {diff, apply} = require('json8-patch')
const pointer = require('json8-pointer')
const WatchMerged = require('tre-prototypes')

module.exports = function EditorShell(ssb, opts) {
  opts = opts || {}
  const history = History(ssb)
  const watchMerged = WatchMerged(ssb)

  return function renderEditorShell(kv, ctx) {
    ctx = ctx || {}
    const revRoot = revisionRoot(unmergeKv(kv))
    if (!revRoot) return
    const {renderEditor} = ctx
    
    const contentObs = ctx.contentObs || Value(unmergeKv(kv).value.content)
    ctx.contentObs = contentObs
    const previewObs = ctx.previewObs || getPreviewObs(contentObs)
    ctx.previewObs = previewObs
    const baseObs = ctx.baseObs || Value(unmergeKv(kv))
    ctx.baseObs = baseObs

    const revisionsObs = history(revRoot, {reverse: true})
    const willFork = computed( [revisionsObs, baseObs], (revisions, base_kv) => {
      if (!base_kv) return false
      if (!revisions.length) return false
      if (revisions[0].key == base_kv.key) return false
      return true
    })

    const canRebase = computed([revisionsObs, contentObs, baseObs], (revisions, edited, base_kv) => {
      if (!revisions.length) return computed.NO_CHANGE
      if (!(base_kv && base_kv.value && base_kv.value.content)) return computed.NO_CHANGE
      const original = base_kv.value.content
      const isSame = diff(original, edited).length == 0
      if (isSame) return revisions[0]
    })

    const abortWatch = watch(canRebase, newBase => {
      if (!newBase) return
      if (baseObs().key == newBase.key) return
      setTimeout( ()=> {
        console.warn('Auto-rebassing from', baseObs(), 'to', newBase)
        baseObs.set(newBase)
        contentObs.set(newBase.value.content)
      },0)
    })

    return h('div.tre-editor-shell', {
      hooks: [el => abortWatch],
    }, [
      externalChanges(revRoot, baseObs, contentObs, revisionsObs),
      renderEditor(kv, ctx),
      localChanges(contentObs, baseObs),
      saveButton()
    ])

    function saveButton() {
      return computed([willFork, baseObs, contentObs], (fork, base_kv, content) => {
        const disabled = diff(base_kv.value.content, content).length == 0
        const label = fork ? 'Publish (will fork)' : 'Publish'
        return h('button', {
          disabled,
          'ev-click': e => {
            if (opts.save) {
              const content = Object.assign({}, contentObs(), {
                revisionRoot: revisionRoot(baseObs()),
                revisionBranch: baseObs().key
              })
              opts.save({
                key: baseObs().key,
                value: { content }
              }, (err, new_kv) => {
                if (err) return
                kv = new_kv
                const newContent = kv.value.content
                contentObs.set(newContent)
                baseObs.set(kv)
              })
            }
          }
        }, label)
      })
    }
  }

  function externalChanges(revRoot, baseObs, contentObs, revisionsObs) {
    return computed( [revisionsObs, baseObs, contentObs], (revisions, base_kv, content) => {
      if (!base_kv) return h('span', 'No base')

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
        return h('div.new-revision', [
          h('details', [
            h('summary', `${author.substr(0, 5)} has published revision ${rev.key.substr(0,5)} ${time}`),
            h('ul.operations', newRevDiff.map(renderOperation)),
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
        ])
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
        h('ul.operations', operations.map(renderOperation)),
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
      h('span.path', pointer.decode(path).join('.')),
      h(`span.value.${typeof value}`, typeof value == 'string' ? value : `[${typeof value}]`),
      h('span.from', from),
      opts.applyButton ? h('button', {
        'ev-click': e => {
          setTimeout( () => applyPatch([o], opts.contentObs), 0)
        }
      }, 'Apply') : []
    ])
  }

  function getPreviewObs(contentObs) {
    const editing_kv = computed(contentObs, content => {
      if (!content) return null
      return {
        key: 'draft',
        value: {
          content
        }
      }
    })
    return watchMerged(editing_kv)
  }
}

function revisionRoot(kv) {
  return kv && kv.value.content && kv.value.content.revisionRoot || kv.key
}

function unmergeKv(kv) {
  // if the message has prototypes and they were merged into this message value,
  // return the unmerged/original value
  return kv && kv.meta && kv.meta['prototype-chain'] && kv.meta['prototype-chain'][0] || kv
}
