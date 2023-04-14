<template>
  <div>
    <div v-mwlTextInputHighlightContainer>
      <textarea v-mwlTextInputElement class="form-control" v-model="text" ref="textarea" @input="addTags"></textarea>
      <mwl-text-input-highlight :tags="tags" :textInputElement="$refs.textarea">
      </mwl-text-input-highlight>
    </div>
  </div>
</template>

<script>
import { defineComponent, onMounted, ref } from 'vue'

export default defineComponent({
  setup() {
    const tags = ref([])
    const text = ref(
      'liyunhe6@example.com;wangeditor@qq.com'
    )
    const tagClicked = ref()

    onMounted(() => {
      addTags()
    })

    return {
      tags,
      text,
      tagClicked,
      addTags,
    }

    function addTags() {
      tags.value = []

      var mailObjects = text.value.split(';').map(mail => {
        const atPosition = mail.lastIndexOf('@')
        return {
          mail: mail.trim(),
          isValid: validateEmail(mail),
          isJd: jdEmail(mail),
          atPosition,
        }
      })

      var index = 0;
      for (var obj of mailObjects) {
        const { mail, isValid, isJd, atPosition } = obj;
        if (!isValid) {
          addTag(index, index + mail.length, mail, 'mail-invalid')
          index += mail.length + 1
          continue;
        }

        if (!isJd) {
          addTag(index + atPosition + 1, index + mail.length, mail.substring(atPosition + 1), 'mail-invalid')
          index += mail.length + 1
          continue;
        }

        addTag(index, index + mail.length, mail, 'mail-valid')
        index += mail.length + 1
        continue;
      }

      function addTag(start, end, data, cssClass) {
        tags.value.push({
          indices: {
            start,
            end,
          },
          data,
          cssClass
        })
      }
    }

    function validateEmail(value) {
      var input = document.createElement('input');

      input.type = 'email';
      input.required = true;
      input.value = value;

      // 检测通常的邮件格式
      var isBasicValid = typeof input.checkValidity === 'function' ? input.checkValidity() : /\S+@\S+\.\S+/.test(value);

      // 判断是否为无点域名
      var atPosition = input.value.lastIndexOf('@')
      var domain = input.value.substring(atPosition + 1)
      var isDotlessDomain = !domain.includes('.')

      var isValid = isBasicValid && !isDotlessDomain
      return isValid
    }

    function jdEmail(value) {
      var atPosition = value.lastIndexOf('@')
      var domain = value.substring(atPosition + 1)
      return domain.toLowerCase().trim() === 'example.com'
    }
  },
})
</script>

<style>
.form-control {
  width: 600px;
  height: 400px;
  font-size: 28px;
}

.mail-invalid {
  color: red;
}

.mail-valid {
  color: darkgreen;
  text-decoration: underline;
}
</style>
