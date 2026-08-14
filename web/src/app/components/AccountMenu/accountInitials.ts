export const accountInitials = (email: string): string => {
  const separatorIndex = email.indexOf("@");
  const accountName = email.slice(0, separatorIndex < 0 ? email.length : separatorIndex);
  const accountNameParts = accountName
    .split(/[._-]/)
    .filter(part => part.length > 0);
  const initials = accountNameParts.length > 1
    ? accountNameParts.slice(0, 2).map(part => part.slice(0, 1).toUpperCase()).join("")
    : accountName.slice(0, 2).toUpperCase();

  return initials.length > 0 ? initials : "A";
};
