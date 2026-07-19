import * as fs from "node:fs";
import type { TokenSet } from "../../types";
import type { TokenStore } from "./token-store";

export class FileTokenStorage implements TokenStore {
  private tokens: TokenSet | null = null;

  constructor(private readonly tokenPath: string) {}

  loadTokens(): TokenSet | null {
    if (this.tokens) return this.tokens;

    try {
      this.tokens = JSON.parse(
        fs.readFileSync(this.tokenPath, "utf8"),
      ) as TokenSet;
      return this.tokens;
    } catch {
      return null;
    }
  }

  saveTokens(nextTokens: TokenSet): void {
    this.tokens = nextTokens;
    fs.writeFileSync(this.tokenPath, JSON.stringify(nextTokens), "utf8");
  }
}

