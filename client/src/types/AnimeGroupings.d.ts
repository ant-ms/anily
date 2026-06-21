export type CommonDetails = {
  anilistId: number;
  titleEnglish: string | null;
  titleRomanji: string | null;
  titleNative: string | null;
  thumbnailUrl: string | null;
};

export type ChainNode = CommonDetails & {
  children: ChainNode[];
};

export default interface AnimeGroupingsData {
  chains: ChainNode[];
  notInChain: CommonDetails[];
}
