import { Injectable, NotFoundException } from "@nestjs/common";
import { access, readdir, readFile } from "node:fs/promises";
import { resolve } from "node:path";

const DOC_NAME_PATTERN = /^[A-Za-z0-9_-]+$/;

@Injectable()
export class DocsService {
  async listSpecs() {
    const specsDir = await this.resolveDocsDir("specs");
    const files = (await readdir(specsDir))
      .filter((file) => file.endsWith(".md"))
      .sort((left, right) => left.localeCompare(right));

    return Promise.all(files.map(async (file) => {
      const content = await readFile(resolve(specsDir, file), "utf-8");
      const title = content
        .split(/\r?\n/)
        .find((line) => line.startsWith("# "))
        ?.slice(2)
        .trim();

      return {
        name: file.slice(0, -3),
        title: title || file.slice(0, -3)
      };
    }));
  }

  async getSpec(name: string) {
    const filePath = await this.resolveMarkdownFile("specs", name);

    return {
      name,
      content: await readFile(filePath, "utf-8")
    };
  }

  async listSkills() {
    const skillsDir = await this.resolveDocsDir("skills");
    const files = (await readdir(skillsDir))
      .filter((file) => file.endsWith(".md"))
      .sort((left, right) => left.localeCompare(right));

    return Promise.all(files.map(async (file) => {
      const content = await readFile(resolve(skillsDir, file), "utf-8");
      const description = this.readFrontmatterValue(content, "description");

      return {
        name: file.slice(0, -3),
        description: description || file.slice(0, -3)
      };
    }));
  }

  async getSkill(name: string) {
    const filePath = await this.resolveMarkdownFile("skills", name);

    return {
      name,
      content: await readFile(filePath, "utf-8")
    };
  }

  private async resolveMarkdownFile(directory: "specs" | "skills", name: string) {
    if (!DOC_NAME_PATTERN.test(name)) {
      throw new NotFoundException("文档不存在");
    }

    const docsDir = await this.resolveDocsDir(directory);
    const filePath = resolve(docsDir, `${name}.md`);

    try {
      await access(filePath);
      return filePath;
    } catch {
      throw new NotFoundException("文档不存在");
    }
  }

  private async resolveDocsDir(directory: "specs" | "skills") {
    const baseRoot = resolve(__dirname, "../../..");
    const candidates = [
      resolve(baseRoot, directory),
      resolve(baseRoot, "..", directory),
      resolve(baseRoot, "..", "..", directory)
    ];

    for (const candidate of candidates) {
      try {
        await access(candidate);
        return candidate;
      } catch {
        continue;
      }
    }

    throw new NotFoundException("文档目录不存在");
  }

  private readFrontmatterValue(content: string, key: string) {
    const match = content.match(/^---\r?\n([\s\S]*?)\r?\n---/);

    if (!match) {
      return "";
    }

    const field = match[1]
      .split(/\r?\n/)
      .find((line) => line.startsWith(`${key}:`));

    return field?.slice(key.length + 1).trim() ?? "";
  }
}
