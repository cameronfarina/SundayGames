export const accountInitial = (email: string): string => {
  const separatorIndex = email.indexOf("@");
  const accountName = email.slice(0, separatorIndex < 0 ? email.length : separatorIndex);
  const firstNamePart = accountName
    .split(/[._-]/)
    .find(part => part.length > 0);

  return firstNamePart === undefined ? "A" : firstNamePart.slice(0, 1).toUpperCase();
};
