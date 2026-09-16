# TicketUG authorization matrix

| Role | Scope | Capability category |
|---|---|---|
| ATTENDEE | own profile/resources | Read and manage own attendee data |
| ORGANIZER_OWNER | active organizer membership | Full organizer management |
| ORGANIZER_MANAGER | active organizer membership | Organizer operations except ownership/security changes |
| EVENT_STAFF | assigned event context | Operational access only to assigned events |
| PLATFORM_SUPPORT | platform support scope | Support operations granted by policy |
| PLATFORM_ADMIN | platform | Platform administration |
| SUPER_ADMIN | platform | Highest platform authority |

Authorization is server-side. Client navigation is advisory only. Resource checks must compare the authenticated session mapping with the resource owner, active organizer membership, or explicit event assignment. Multiple memberships require an explicit organizer context; no first-record fallback is permitted.
