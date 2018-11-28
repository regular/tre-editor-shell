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

setStyle(`
  body {
    --tre-selection-color: green;
    --tre-secondary-selection-color: yellow;
    font-family: sans;
  }
  h1 {
    font-size: 18px;
  }
  .pane {
    background: #eee;
  }
  .tre-finder {
    max-width: 300px;
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
`)

client( (err, ssb, config) => {
  if (err) return console.error(err)

  const primarySelection = Value()
  
  const renderFinder = Finder(ssb, {
    primarySelection,
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
    },
    save: content => {
      console.log('new content', content)
    }
  })

  const renderShell = Shell(ssb)

  document.body.appendChild(
    h('div.tre-prototypes-demo', [
      makeSplitPane({horiz: true}, [
        makePane('25%', [
          h('h1', 'Finder'),
          renderFinder(config.tre.branches.root)
        ]),
        makeDivider(),
        makePane('70%', [
          h('h1', 'Editor'),
          computed(primarySelection, kv => kv ? [
            renderShell(kv, {renderEditor, contentObs: Value(kv.value.content)})
          ] : [])
        ])
      ])
    ])
  )
})
