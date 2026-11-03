export const TROPHEE: {
  readonly nom: string;
  readonly url: string;
  readonly jour: string;
  readonly debut: string;
  readonly fin: string;
  readonly entree: string;
};
export const tropheeActif: (t?: number) => boolean;
export const joursAvantTrophee: (t?: Date) => number;
export const compteTrophee: (t?: Date) => string;
export const REPONSE_TROPHEE: string;
