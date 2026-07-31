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

- 异常/升级路径: owner 冲突、契约冲突、lane 阻塞时回到 PM 仲裁,必要时由 Architect 先收敛技术边界。
