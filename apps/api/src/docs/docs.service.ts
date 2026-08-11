import { Injectable, NotFoundException } from "@nestjs/common";
import { access, readdir, readFile } from "node:fs/promises";
import { resolve } from "node:path";

const DOC_NAME_PATTERN = /^[A-Za-z0-9_-]+$/;

@Injectable()
export class DocsService {
  async listSpecs() {
    const specsDir = await this.resolveDocsDir("specs");
    const files = await this.listMarkdownFiles(specsDir);

    return Promise.all(files.map(async (file) => {
      const content = await readFile(file, "utf-8");
      const title = content
        .split(/\r?\n/)
        .find((line) => line.startsWith("# "))
        ?.slice(2)
        .trim();

      return {
        name: this.readDocName(file),
        title: title || this.readDocName(file)
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
    const files = await this.listMarkdownFiles(skillsDir);

    return Promise.all(files.map(async (file) => {
      const content = await readFile(file, "utf-8");
      const description = this.readFrontmatterValue(content, "description");

      return {
        name: this.readDocName(file),
        description: description || this.readDocName(file)
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
      throw new NotFoundException("Document not found");
    }

    const docsDir = await this.resolveDocsDir(directory);
    const files = await this.listMarkdownFiles(docsDir);
    const filePath = files.find((file) => this.readDocName(file) === name);

    if (!filePath) {
      throw new NotFoundException("Document not found");
    }

    return filePath;
  }

  private async resolveDocsDir(directory: "specs" | "skills") {
    const baseRoot = resolve(__dirname, "../../..");
    const rootCandidates = [
      baseRoot,
      resolve(baseRoot, ".."),
      resolve(baseRoot, "..", "..")
    ];

    for (const root of rootCandidates) {
      for (const candidate of [resolve(root, ".ai", directory), resolve(root, directory)]) {
        try {
          await access(candidate);
          return candidate;
        } catch {
          continue;
        }
      }
    }

    throw new NotFoundException("Document directory not found");
  }

  private async listMarkdownFiles(directory: string): Promise<string[]> {
    const entries = await readdir(directory, { withFileTypes: true });
    const files = await Promise.all(entries.map(async (entry) => {
      const entryPath = resolve(directory, entry.name);

      if (entry.isDirectory()) {
        return this.listMarkdownFiles(entryPath);
      }

      return entry.name.endsWith(".md") ? [entryPath] : [];
    }));

    return files
      .flat()
      .sort((left, right) => left.localeCompare(right));
  }

  private readDocName(filePath: string) {
    return filePath.slice(filePath.lastIndexOf("/") + 1, -3);
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
