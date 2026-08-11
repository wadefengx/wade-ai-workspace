"use client";

import { Skeleton } from "antd";
import styles from "./skeleton.module.css";

export function WorkspaceSkeleton() {
  return (
    <div className={styles.shell}>
      <aside className={styles.sidebar}>
        <div className={styles.brandBlock} />
        <div className={styles.sidebarSection}>
          <Skeleton.Button active size="small" block />
        </div>
        <div className={styles.sidebarList}>
          {[0, 1, 2, 3, 4].map((i) => (
            <Skeleton.Button key={i} active size="small" block style={{ height: 36 }} />
          ))}
        </div>
        <div className={styles.sidebarSection}>
          <Skeleton.Button active size="small" block />
        </div>
        <div className={styles.sidebarList}>
          {[0, 1, 2, 3].map((i) => (
            <Skeleton.Button key={i} active size="small" block style={{ height: 36 }} />
          ))}
        </div>
      </aside>
      <div className={styles.main}>
        <div className={styles.topbar}>
          <Skeleton.Input active size="small" style={{ width: 200 }} />
          <Skeleton.Avatar active size="small" shape="circle" style={{ marginInlineStart: "auto" }} />
        </div>
        <div className={styles.content}>
          <div className={styles.contentHeader}>
            <Skeleton.Input active size="small" style={{ width: 180 }} />
            <Skeleton.Input active size="small" style={{ width: 320 }} />
          </div>
          {[0, 1, 2].map((i) => (
            <div className={styles.contentCard} key={i}>
              <Skeleton active paragraph={{ rows: 3 }} />
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
