import { TokenSet } from "../../types";

export interface TokenStore {

    loadTokens(): TokenSet | null;
    saveTokens(nextTokens: TokenSet): void;
}

