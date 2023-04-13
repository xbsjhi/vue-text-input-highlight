import { defineComponent, getCurrentInstance, onMounted, onUnmounted, ref, toRefs, watch, nextTick, h } from "vue";

const styleProperties = Object.freeze([
  'direction', // RTL support
  'boxSizing',
  'width', // on Chrome and IE, exclude the scrollbar, so the mirror div wraps exactly as the textarea does
  'height',
  'overflowX',
  'overflowY', // copy the scrollbar for IE

  'borderTopWidth',
  'borderRightWidth',
  'borderBottomWidth',
  'borderLeftWidth',
  'borderStyle',

  'paddingTop',
  'paddingRight',
  'paddingBottom',
  'paddingLeft',

  // https://developer.mozilla.org/en-US/docs/Web/CSS/font
  'fontStyle',
  'fontVariant',
  'fontWeight',
  'fontStretch',
  'fontSize',
  'fontSizeAdjust',
  'lineHeight',
  'fontFamily',

  'textAlign',
  'textTransform',
  'textIndent',
  'textDecoration', // might not make a difference, but better be safe

  'letterSpacing',
  'wordSpacing',

  'tabSize',
  'MozTabSize'
]);

const tagIndexIdPrefix = 'text-highlight-tag-id-';

function indexIsInsideTag(index, tag) {
  return tag.indices.start < index && index < tag.indices.end;
}

function overlaps(tagA, tagB) {
  return (
    indexIsInsideTag(tagB.indices.start, tagA) ||
    indexIsInsideTag(tagB.indices.end, tagA)
  );
}

function isCoordinateWithinRect(rect, x, y) {
  return rect.left < x && x < rect.right && (rect.top < y && y < rect.bottom);
}

function escapeHtml(str) {
  return str.replace(/</g, '&lt;').replace(/>/g, '&gt;');
}

export default defineComponent({
  props: [
    "tagCssClass",
    "tags",
    "textInputElement",
    "textInputValue",
  ],
  emits: [
    "tagClick",
    "tagMouseEnter",
    "tagMouseLeave",
  ],
  setup(props, ctx) {
    const { proxy: vm } = getCurrentInstance();
    const { tagCssClass, tags, textInputElement, textInputValue } = toRefs(props)

    const highlightElementContainerStyle = ref({})
    const highlightedText = ref('')
    const textareaEventListeners = ref([])
    const highlightTagElements = ref([])
    const mouseHoveredTag = ref()
    const isDestroyed = ref(false)

    const highlightElement = () => vm.$refs.highlightElement;

    watch(textInputElement, textInputElementChanged)
    watch([tags, tagCssClass, textInputValue], addTags)

    onMounted(() => {
      window.addEventListener('resize', onWindowResize)
    })

    onUnmounted(() => {
      isDestroyed.value = true;
      textareaEventListeners.value.forEach(unregister => unregister())
      window.removeEventListener('resize', onWindowResize)
    })

    return () => h('div', {
      ref: "highlightElement",
      staticClass: "text-highlight-element",
      style: (highlightElementContainerStyle.value),
      domProps: {
        "innerHTML": highlightedText.value
      }
    })

    function refresh() {
      const computedStyle = getComputedStyle(textInputElement.value);
      debugger
      styleProperties.forEach(prop => {
        highlightElementContainerStyle.value[prop] = computedStyle[prop]
      })
      addTags()
    }

    function onWindowResize() {
      refresh()
    }

    function textInputElementChanged() {
      const elementType = textInputElement.value.tagName.toLowerCase();
      if (elementType !== 'textarea') {
        throw new Error(
          'The angular-text-input-highlight component must be passed ' +
          'a textarea to the `textInputElement` input. Instead received a ' +
          elementType
        );
      }

      nextTick(() => {
        // in case the element was destroyed before the timeout fires
        if (!isDestroyed.value) {
          refresh();

          textareaEventListeners.value.forEach(unregister => unregister());
          textareaEventListeners.value = [
            renderer_listen(textInputElement.value, 'input', () => {
              addTags();
            }),
            renderer_listen(textInputElement.value, 'scroll', () => {
              highlightElement().scrollTop = textInputElement.value.scrollTop;
              highlightTagElements.value = highlightTagElements.value.map(tag => {
                tag.clientRect = tag.element.getBoundingClientRect();
                return tag;
              });
            }),
            renderer_listen(textInputElement.value, 'resize', () => {
              refresh();
            })
          ];



          // only add event listeners if the host component actually asks for it\


          if (vm.$listeners.tagClick) {
            const onClick = renderer_listen(
              textInputElement.value,
              'click',
              event => {
                handleTextareaMouseEvent(event, 'click');
              }
            );
            textareaEventListeners.value.push(onClick);
          }

          if (vm.$listeners.tagMouseEnter) {
            const onMouseMove = renderer_listen(
              textInputElement.value,
              'mousemove',
              event => {
                handleTextareaMouseEvent(event, 'mousemove');
              }
            );
            const onMouseLeave = renderer_listen(
              textInputElement.value,
              'mouseleave',
              event => {
                if (mouseHoveredTag.value) {
                  ctx.emit('tagMouseLeave', mouseHoveredTag.value)
                  mouseHoveredTag.value = undefined;
                }
              }
            );
            textareaEventListeners.value.push(onMouseMove);
            textareaEventListeners.value.push(onMouseLeave);
          }

          addTags();
        }
      });
    }

    function addTags() {
      const _textInputValue = typeof textInputValue.value !== 'undefined' ? textInputValue.value : textInputElement.value.value;

      const prevTags = [];
      const parts = [];

      [...tags.value]
        .sort((tagA, tagB) => {
          return tagA.indices.start - tagB.indices.start;
        })
        .forEach(tag => {
          if (tag.indices.start > tag.indices.end) {
            throw new Error(
              `Highlight tag with indices [${tag.indices.start}, ${tag.indices
                .end}] cannot start after it ends.`
            );
          }

          prevTags.forEach(prevTag => {
            if (overlaps(prevTag, tag)) {
              throw new Error(
                `Highlight tag with indices [${tag.indices.start}, ${tag.indices
                  .end}] overlaps with tag [${prevTag.indices.start}, ${prevTag
                    .indices.end}]`
              );
            }
          });

          // TODO - implement this as an ngFor of items that is generated in the template for a cleaner solution

          const expectedTagLength = tag.indices.end - tag.indices.start;
          const tagContents = _textInputValue.slice(
            tag.indices.start,
            tag.indices.end
          );
          if (tagContents.length === expectedTagLength) {
            const previousIndex =
              prevTags.length > 0 ? prevTags[prevTags.length - 1].indices.end : 0;
            const before = _textInputValue.slice(previousIndex, tag.indices.start);
            parts.push(escapeHtml(before));
            const cssClass = tag.cssClass || tagCssClass.value;
            const tagId = tagIndexIdPrefix + tags.value.indexOf(tag);
            // text-highlight-tag-id-${id} is used instead of a data attribute to prevent an angular sanitization warning
            parts.push(
              `<span class="text-highlight-tag ${tagId} ${cssClass}">${escapeHtml(
                tagContents
              )}</span>`
            );
            prevTags.push(tag);
          }
        });
      const remainingIndex =
        prevTags.length > 0 ? prevTags[prevTags.length - 1].indices.end : 0;
      const remaining = _textInputValue.slice(remainingIndex);
      parts.push(escapeHtml(remaining));
      parts.push('&nbsp;');
      highlightedText.value = parts.join('');
      // this.cdr.detectChanges();
      vm.$forceUpdate()
      highlightTagElements.value = Array.from(
        highlightElement().getElementsByTagName('span')
      ).map((element) => {
        return { element, clientRect: element.getBoundingClientRect() };
      });
    }

    function handleTextareaMouseEvent(
      event,
      eventName
    ) {
      const matchingTagIndex = highlightTagElements.value.findIndex(elm =>
        isCoordinateWithinRect(elm.clientRect, event.clientX, event.clientY)
      );
      if (matchingTagIndex > -1) {
        const target = highlightTagElements.value[matchingTagIndex].element;
        const tagClass = Array.from(target.classList).find(className =>
          className.startsWith(tagIndexIdPrefix)
        );
        if (tagClass) {
          const tagId = tagClass.replace(tagIndexIdPrefix, '');
          const tag = tags.value[+tagId];
          const tagMouseEvent = { tag, target, event };
          if (eventName === 'click') {
            ctx.emit('tagClick', tagMouseEvent)
          } else if (!mouseHoveredTag.value) {
            mouseHoveredTag.value = tagMouseEvent;
            ctx.emit('tagMouseEnter', tagMouseEvent)
          }
        }
      } else if (eventName === 'mousemove' && mouseHoveredTag.value) {
        mouseHoveredTag.value.event = event;
        ctx.emit('tagMouseLeave', mouseHoveredTag.value)
        mouseHoveredTag.value = undefined;
      }
    }

    function renderer_listen(el, eventName, callback) {
      if (eventName === 'resize' && el !== window) {
        const observer = new ResizeObserver(callback).observe(el)
        return () => {
          observer.unobserve();
        }
      } else {
        el.addEventListener(eventName, callback)
        return () => {
          el.removeEventListener(eventName, callback)
        }
      }
    }
  },
})