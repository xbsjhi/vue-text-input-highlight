import Vue from 'vue'
import './style.css'
import App from './App.vue'
import TextInputHighlight from 'vue-text-input-highlight'

Vue.use(TextInputHighlight)

new Vue(App).$mount('#app')
