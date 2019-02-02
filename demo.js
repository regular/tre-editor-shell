const {client} = require('tre-client')
const Finder = require('tre-finder')
const Editor = require('tre-json-editor')
const Shell = require('.')
const h = require('mutant/html-element')
const Value = require('mutant/value')
const computed = require('mutant/computed')
const setStyle = require('module-styles')('tre-editor-shell-demo')
const {makePane, makeDivider, makeSplitPane} = require('tre-split-pane')
require('brace/theme/solarized_dark')

styles()

client( (err, ssb, config) => {
  if (err) return console.error(err)

  const renderFinder = Finder(ssb, {
    skipFirstLevel: true,
    factory: {
      menu: ()=> [{label: 'Object', type: 'object'}],
      make: type => type == 'object' && {
        type: 'object',
        text: "Hi, I'm Elfo!"
      }
    }
  })

  const renderEditor = Editor(null, {
    ace: {
      theme: 'ace/theme/solarized_dark',
      tabSize: 2,
      useSoftTabs: true
    }
  })

  const renderShell = Shell(ssb, {
    save: (kv, cb) => {
      ssb.publish(kv.value.content, cb)
    }
  })

  document.body.appendChild(
    h('div.tre-prototypes-demo', [
      makeSplitPane({horiz: true}, [
        makePane('25%', [
          h('h1', 'Finder'),
          renderFinder(config.tre.branches.root)
        ]),
        makeDivider(),
        makePane('70%', [
          h('h1', 'Editor Shell'),
          computed(renderFinder.primarySelectionObs, kv => {
            if (!kv) return []
            console.warn('rendering EditorShell for', kv.key)
            return renderShell( kv, {renderEditor})
          })
        ])
      ])
    ])
  )
})

function revisionRoot(kv) {
  return kv && kv.value.content && kv.value.content.revisionRoot || kv && kv.key
}

function unmergeKv(kv) {
  // if the message has prototypes and they were merged into this message value,
  // return the unmerged/original value
  return kv && kv.meta && kv.meta['prototype-chain'] && kv.meta['prototype-chain'][0] || kv
}

function styles() {
  setStyle(`
    body, html, .tre-prototypes-demo {
      margin: 0;
      padding: 0;
      height: 100%;
      width: 100%;
    }
    body {
      --tre-selection-color: green;
      --tre-secondary-selection-color: yellow;
      font-family: sans-serif;
    }
    h1 {
      font-size: 18px;
    }
    .pane {
      background: #eee;
    }
    .pane > h1 {
      margin-left: 1em;
    }
    
    .tre-finder .summary select {
      font-size: 9pt;
      background: transparent;
      border: none;
      width: 50px;
    }
    .tre-finder summary {
      white-space: nowrap;
    }
    .tre-finder summary:focus {
      outline: 1px solid rgba(255,255,255,0.1);
    }
    .tre-editor-shell {
      width: 100%;
      height: 100%;
    }
    .tre-editor-shell .operations li span {
      margin-right: .5em;
    }
    .tre-editor-shell .new-revision {
      background: #B9A249;
      padding: 1em;
      margin-bottom: 1em;
    }
    .operations span.path {
      font-family: monospace;
    }
    .operations span.value.string:before {
      content: "\\"";
    }
    .operations span.value.string:after {
      content: "\\"";
    }
  `)
}
