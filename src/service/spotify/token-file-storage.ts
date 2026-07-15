import * as fs from "node:fs";
import { TokenStore } from "./token-store";
import { TokenSet } from "../../types";


export class FileTokenStorage implements TokenStore {
    private tokens: TokenSet | null = null;

    constructor(private readonly tokenpath: string, private readonly scopes: string){} 
    
    loadTokens(): TokenSet | null {
        if (this.tokens) return this.tokens;

        try {
            this.tokens = JSON.parse(fs.readFileSync(this.tokenpath, "utf8")) as TokenSet;
            return this.tokens;
        } catch {
            return null;
        }
        }
    saveTokens(nextTokens: TokenSet): void {
        this.tokens = nextTokens;
        fs.writeFileSync(this.tokenpath, JSON.stringify(nextTokens), "utf8");
    }
}


