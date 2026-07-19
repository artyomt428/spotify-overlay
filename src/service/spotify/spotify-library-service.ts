import { SpotifyClient } from "./spotify-client"

export class SpotifyLibraryService{
    constructor(
        private readonly client: SpotifyClient,
    ){}

    async isTrackSaved(trackId: string): Promise<boolean> {

        const uri = this.trackToUri(trackId);
        const result = await this.client.request<boolean[]>(
            `/me/library/contains?uris=${encodeURIComponent(uri)}`,
        );

        return result?.[0] ?? false;

    }

    async setSavedState(
        trackid: string,
        saved: boolean,
    ): Promise <{saved: boolean}> {

        const uri = this.trackToUri(trackid);
        await this.client.request<never>(
          `/me/library?uris=${encodeURIComponent(uri)}`,
          {
            method: saved? "PUT" : "DELETE",
          },
        );

        return { saved };
    }
    private trackToUri(trackId: string): string {
        return trackId.startsWith("spotify")
        ? trackId : `spotify:track:${trackId}`;
    }
}