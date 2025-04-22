import typescript from "@rollup/plugin-typescript";
import resolve from "@rollup/plugin-node-resolve";
import commonjs from "@rollup/plugin-commonjs";

export default {
  input: "src/index.ts",
  output: [
    {
      file: "dist/index.js",
      format: "cjs",
      sourcemap: true,
      exports: "named",
    },
    {
      file: "dist/index.esm.js",
      format: "es",
      sourcemap: true,
      exports: "named",
    },
  ],
  external: [
    "react",
    "react-native",
    "@react-native-async-storage/async-storage",
  ],
  plugins: [
    resolve(),
    commonjs(),
    typescript({
      tsconfig: "./tsconfig.json",
      declaration: true,
      declarationDir: "dist",
      jsx: "react",
      sourceMap: true,
    }),
  ],
};
