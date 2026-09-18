export const PASSWORD_RESET_NAMESPACE = 'maintenance:auth:password-reset';

export const passwordResetKeys = {
  challenge: (challengeId: string) =>
    `${PASSWORD_RESET_NAMESPACE}:challenge:${challengeId}`,
  currentChallenge: (identityDigest: string) =>
    `${PASSWORD_RESET_NAMESPACE}:identity:${identityDigest}:current`,
  cooldown: (identityDigest: string) =>
    `${PASSWORD_RESET_NAMESPACE}:cooldown:${identityDigest}`,
  hourly: (identityDigest: string) =>
    `${PASSWORD_RESET_NAMESPACE}:hourly:${identityDigest}`,
  resetToken: (tokenDigest: string) =>
    `${PASSWORD_RESET_NAMESPACE}:token:${tokenDigest}`,
};
