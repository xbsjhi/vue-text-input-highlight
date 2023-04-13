import './text-input-highlight.css'

import TextInputHighlight from './text-input-highlight.js'

export default {
  install(Vue) {
    Vue.directive('mwlTextInputHighlightContainer', {
      bind(el) {
        el.classList.add('text-input-highlight-container')
      }
    })

    Vue.directive('mwlTextInputElement', {
      bind(el) {
        if (el instanceof HTMLTextAreaElement) {
          el.classList.add('text-input-element')
        }
      }
    })

    Vue.component('mwl-text-input-highlight', TextInputHighlight)
  }
}
