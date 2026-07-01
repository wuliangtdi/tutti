# @tutti-os/auth-bridge

High-level Tutti auth helpers for browser apps and Node/Electron clients.

## Browser

```ts
import { createTuttiBrowserAuthClient } from "@tutti-os/auth-bridge/browser";

const auth = createTuttiBrowserAuthClient();

auth.login();
const user = await auth.getUserInfo();
await auth.logout();
```

## Node

```ts
import { createTuttiNodeAuthClient } from "@tutti-os/auth-bridge/node";

const auth = createTuttiNodeAuthClient({
  authJsonPath,
  appCallbackUrl
});

const { session, user } = await auth.login();
```
