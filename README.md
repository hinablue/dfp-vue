# dfp-vue - A Vue2 implementation for Google DFP

The idea from [jQuery-dfp](https://github.com/coop182/jquery.dfp.js)

# Vue2

Testing Vue2.x.

# Simple Usage

In your `app.js`,

```
import VueDfp from './vue-dfp'

Vue.use(VueDfp, { dfpID: 'your dfp id' })
```

In your component,

```
<template>
  <div>
    <vue-dfp adunit="my_dfp_ad" dimensions="728x90"></vue-dfp>
  </div>
</template>
```

