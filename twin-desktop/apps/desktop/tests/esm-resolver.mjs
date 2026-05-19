export async function resolve(specifier, context, defaultResolve) {
  try {
    return await defaultResolve(specifier, context, defaultResolve);
  } catch (error) {
    if (error?.code === "ERR_UNSUPPORTED_DIR_IMPORT" && specifier.startsWith(".")) {
      return defaultResolve(`${specifier}/index.js`, context, defaultResolve);
    }
    if (
      error?.code === "ERR_MODULE_NOT_FOUND" &&
      specifier.startsWith(".") &&
      !specifier.endsWith(".js") &&
      !specifier.endsWith(".json") &&
      !specifier.endsWith(".node")
    ) {
      return defaultResolve(`${specifier}.js`, context, defaultResolve);
    }
    throw error;
  }
}
