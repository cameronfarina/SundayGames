export const fileBase64 = async (file: File): Promise<string> => await new Promise((resolve, reject) => {
  const reader = new FileReader();
  reader.addEventListener("load", () => {
    if (typeof reader.result !== "string" || !reader.result.includes(",")) {
      reject(new Error("The selected file could not be read."));
      return;
    }
    resolve(reader.result.slice(reader.result.indexOf(",") + 1));
  });
  reader.addEventListener("error", () => { reject(new Error("The selected file could not be read.")); });
  reader.readAsDataURL(file);
});
