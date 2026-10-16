# Security policy

## Reporting a vulnerability

Please do **not** report a security problem in a public issue, pull request or
forum post.

Report it privately through GitHub instead: open the **Security** tab of this
repository, then **Report a vulnerability**.

No such button? Private reporting is not enabled yet: open an issue that only
asks the maintainers for a private contact, without any detail of the problem,
and send the report there.

Include, when you can:

- the version of the integration and of Gladys;
- what an attacker can do, and the steps to reproduce it;
- the log lines that help (remove tokens, passwords and addresses first).

The fix ships as a new version of the integration, and the advisory is
published once users can update.

## Supported versions

Only the latest release receives security fixes: update the integration from
Gladys before reporting a problem.

## Scope

In scope: the code of this repository and the Docker image it publishes.

What the integration handles:

- **The Tomorrow.io API key**, stored by Gladys in the integration
  configuration (a `secret` field, never sent back to the browser). It is sent
  to `api.tomorrow.io` only, in the `apikey` header (never in a URL), and never
  written to the logs nor to `/data`.
- **The coordinates of the houses of Gladys** (`location: true`): read from
  Gladys to ask Tomorrow.io for the weather of each place, and sent to
  `api.tomorrow.io` only, rounded to four decimals.
- **`/data/state.json`**: the times of the calls of the last 24 hours (the
  quota count) and which rain alerts were already fired. No secret, no
  coordinate.
- **Network**: outgoing HTTPS to `api.tomorrow.io` only. The integration opens
  no port and controls nothing: every feature is read-only.

Out of scope: Gladys Assistant itself (see its
[security policy](https://github.com/GladysAssistant/Gladys/security/policy)),
and the Tomorrow.io service.
