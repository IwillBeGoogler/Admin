# Diagrams admin: backend contract

The admin SPA has a "Diagrams" section (projects, project detail, template gallery) and a new `diagram` report target. The `/api/admin/diagrams/*` endpoints are implemented in `Backend/internal/interfaces/http/admin_diagrams.go` (use cases in `Backend/internal/application/diagram_admin.go`). The SPA is built and tested against this contract (MSW mocks); the backend follows it, with the deviations listed under "Implementation notes" at the end.

## Conventions (match the existing `/api/admin/*` endpoints)

Read from `Backend/internal/interfaces/http` (`reports.go`, `handler.go`, `errors.go`) and from the admin repositories (`moderationRepository.ts`, `communityRepository.ts`):

- **Auth**: `Authorization: Bearer <token>`; permission checked server-side (see RBAC below). 401 = no session, 403 = missing permission.
- **Single resource**: `{"data": <object>}`.
- **Lists**: `{"data": [...], "meta": {"limit", "has_more", "next_cursor", "total"?}}`. Cursor paging: send `cursor` and `limit`; `next_cursor` is the opaque cursor for the next page. `total` is optional (admin falls back to the page length). Empty slices may be `null` or `[]`.
- **Writes without a body to return**: `204 No Content`.
- **Errors**: RFC 9457 problem details (`type,title,status,detail,code,numeric_code,request_id`), not the `{error:{code,message}}` shape the public `/api/diagrams` API uses. 404 unknown id, 409 conflict, 422/400 validation (the admin shows `detail` inline).
- **Field names**: `snake_case`. Timestamps are RFC 3339 strings (not unix ms like `/api/diagrams`). Ids are strings (the admin also tolerates numbers and coerces to string).

Mapping from the original sketch: `{items,next}` becomes `{data,meta.next_cursor}`; camelCase (`updatedAt`, `thumbnailUrl`, `fileId`, `filesByKind`, `activeEditors7d`, `storageBytes`) becomes snake_case.

## RBAC

New permission codes (`resource.action`, same form as `report.moderate`). They are added to `ADMIN_PERMISSIONS`, so holding any of them makes an account an admin-panel user. Super admins (wildcard) have all.

| Code | Grants |
| --- | --- |
| `diagrams.read` | Diagrams nav item, stats, project list, project detail (read-only) |
| `diagrams.manage` | Implies the read endpoints. Delete project, revoke share link. Shows delete/revoke buttons |
| `templates.manage` | Templates nav item and page, all template endpoints |

Server rule: `GET` diagram endpoints accept `diagrams.read` or `diagrams.manage`; `DELETE`/`revoke` need `diagrams.manage`; templates need `templates.manage`. The SPA gates the same way (`RequirePermission anyOf`).

## Endpoints

### `GET /api/admin/diagrams/stats`

```json
{"data": {"projects": 12, "files": 40,
  "files_by_kind": {"sdd": 20, "erd": 10, "uml": 6, "board": 4},
  "active_editors_7d": 7, "storage_bytes": 1536}}
```

`active_editors_7d` = distinct users who saved an edit in the last 7 days. `storage_bytes` = total stored diagram data.

### `GET /api/admin/diagrams/projects?q=&owner=&cursor=&limit=`

- `q`: case-insensitive substring of the project name. `owner`: exact owner username. Order: `updated_at` desc. Default limit 10, max 50 (`domain.DefaultLimit`/`MaxLimit`); admin sends 20.

```json
{"data": [{"id": "p1", "name": "Payments", "owner": {"id": "2", "username": "ali"},
  "files": 3, "updated_at": "2030-01-01T00:00:00Z", "thumbnail_url": null, "shared": true}],
 "meta": {"limit": 20, "has_more": true, "next_cursor": "c1"}}
```

`shared` = at least one active (not revoked, not expired) share link.

### `GET /api/admin/diagrams/projects/{id}`

```json
{"data": {"id": "p1", "name": "Payments", "owner": {"id": "2", "username": "ali"},
  "created_at": "...", "updated_at": "...", "thumbnail_url": null, "shared": true,
  "files": [{"id": "f1", "name": "Checkout", "kind": "sdd", "version": 4,
             "updated_at": "...", "thumbnail_url": null}],
  "members": [{"user_id": "5", "username": "bob", "role": "editor", "joined_at": "..."}],
  "shares": [{"id": "s1", "role": "viewer", "created_by": "ali", "created_at": "...",
              "expires_at": null, "revoked_at": null}]}}
```

`kind` is one of `sdd | erd | uml | board`. Share rows include revoked/expired ones; the SPA derives status. Never return the share token/URL, and never return file `data`.

### `DELETE /api/admin/diagrams/projects/{id}` -> 204

Hard-deletes the project with its files, versions, members and share links. 404 if unknown. Should write an audit entry.

### `POST /api/admin/diagrams/shares/{shareId}/revoke` -> 204

Sets `revoked_at`; live sessions on that link must lose access. Idempotent on an already revoked link (204). 404 if unknown.

### Templates

`Template = {id, title, kind: "system"|"db"|"ood", description, file_id, published, position}`

- `GET /api/admin/diagrams/templates` -> `{"data": [Template...]}` (all, published or not; admin sorts by `position`, then title).
- `POST /api/admin/diagrams/templates` body `{title, kind, description, file_id, published, position}` -> `201 {"data": Template}`. `title` 1-120 chars, `description` up to 500, `file_id` must reference an existing diagram file (else 400 with `detail`; the admin shows it inline). The admin sends `position` = max existing + 1.
- `PATCH /api/admin/diagrams/templates/{id}` partial body of the same fields -> `200 {"data": Template}`. The admin PATCHes `{published}` for the toggle and `{position}` (two calls, swapping neighbours) for reordering. Equal positions are tolerated.
- `POST /api/admin/diagrams/templates/reorder` body `{"ids": ["tpl_a", "tpl_b", ...]}` -> `200 {"data": [Template...]}` (the new order). Atomic: the listed templates take positions `0..n-1` in that order, any template not listed follows in its current order and the whole gallery is renumbered, in one transaction. An unknown id is `404` and nothing changes; an empty list is `400`. Needs `templates.manage`. Prefer it to two `PATCH {position}` calls: it cannot leave a half-swapped gallery.
- `DELETE /api/admin/diagrams/templates/{id}` -> 204. Removes it from the gallery only; the source file stays.

The public template gallery should list only `published` rows ordered by `position`.

## Reports: `diagram` target on the existing queue

No new queue. The existing `/api/admin/reports` list and `PUT /api/admin/reports/{id}` are reused. Backend changes:

1. `POST /api/reports` (and the `report.TargetType` enum) accept `target_type: "diagram"` with `target_file_id` (string) instead of `target_id`. Same rules as other targets: one open report per target per caller (409), rate limit, `note` required for reason `other`.
2. `GET /api/admin/reports` items for diagram targets: `target_type: "diagram"`, `target_id: 0`, `target_file_id: "<fileId>"`, optional `target_project_id: "<projectId>"` (the admin links the target to `/diagrams/{projectId}` when present). Other fields unchanged (`reports` = open reports on the same file).
3. `PUT /api/admin/reports/{id}` with `{status:"resolved", remove_content:true}` on a diagram report deletes the reported file (needs `diagrams.manage` in addition to `report.moderate`, like post/comment removal). Dismiss/resolve without removal is unchanged. Deciding closes every open report on that file, as for other targets.

## Frontend map

- Context: `src/contexts/diagrams` (`domain/diagram.ts` schemas + rules, `infrastructure/diagramsRepository.ts`, `application/hooks.ts`, `ui/*`).
- Routes: `/diagrams`, `/diagrams/$projectId`, `/diagram-templates`; nav group "Diagrams".
- Reports change: `src/contexts/moderation` (`domain/report.ts`, `ui/ReportsPage.tsx`).
- i18n: `en`, `ru`, `uz` (`nav.diagrams*`, `diagrams.*`, `templates.*`, `reports.t.diagram`).
- Tests (MSW): `src/contexts/diagrams/**/*.test.*`, `report.test.ts`, `ReportsPage.test.tsx`, `nav.test.ts`.

## Implementation notes

Checked against `admin_diagrams.go`: routes, permissions (read endpoints accept `diagrams.read` or `diagrams.manage`), `{data}` / `{data, meta}` envelopes, snake_case fields, RFC 3339 times, 204 on delete/revoke, 201 on template create, reorder semantics and the `diagram` report target (`reports.go`, `target_file_id`) all match. Deviations and details:

- **Validation status is 400, not 422/409.** A bad template body or a `file_id` that references no diagram file answers 400 (`diagram.Validation`), problem details with `detail` such as `file_id: no such diagram file`.
- **List `limit`** defaults to 10 and is capped at 50 (the admin sends 20, so unaffected). `meta.total` is never sent.
- **Stats** always returns all four `files_by_kind` keys (zero when empty).
- **Thumbnails** are `/api/diagrams/assets/<hash>` URLs (public, no credentials), or `null`.
- **Template list** is `{"data": [...]}`, `[]` when empty (never `null`).
- A 404 `detail` names the missing thing (`Project`, `Share link`, `Template`, `File`).
