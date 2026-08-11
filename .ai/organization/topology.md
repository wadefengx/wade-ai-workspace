# Organization Topology

```txt
User Task
   |
   v
  PM
   |
   v
Architect
   |
   +-------------------+
   |                   |
   v                   v
Frontend            Backend
   \                   /
    \                 /
     +------ QA ------+
             |
             v
          Harness
             |
             v
           Memory
```

- Exception/escalation path: when an owner conflict, contract conflict, or lane blockage occurs, return to PM arbitration; the Architect narrows technical boundaries first when necessary.
