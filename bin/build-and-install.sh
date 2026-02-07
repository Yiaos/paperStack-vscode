#!/bin/bash
set -e

# 获取插件根目录
BIN_DIR="$( cd "$( dirname "${BASH_SOURCE[0]}" )" && pwd )"
EXT_DIR="$( cd "$BIN_DIR/.." && pwd )"

cd "$EXT_DIR"

echo "----------------------------------------"
echo "🧪 [1/4] 运行核心单元测试..."
echo "----------------------------------------"
# 仅运行 src 下的逻辑测试，彻底避开外部 mock 环境干扰
pnpm vitest run src/

echo ""
echo "----------------------------------------"
echo "🏗️ [2/4] 执行生产环境构建..."
echo "----------------------------------------"
pnpm build

echo ""
echo "----------------------------------------"
echo "📦 [3/4] 打包 VSIX 插件包..."
echo "----------------------------------------"
# 获取版本号以确定文件名
VERSION=$(node -p "require('./package.json').version")
VSIX_FILE="ai-${VERSION}.vsix"

# 使用 --no-dependencies 避免 pnpm 环境下 npm list 的报错干扰
pnpm exec vsce package -o "$VSIX_FILE" --no-dependencies

echo ""
echo "----------------------------------------"
echo "🚀 [4/4] 正在安装到 VS Code..."
echo "----------------------------------------"

# 优先使用当前目录下的绝对路径
FULL_VSIX_PATH="$EXT_DIR/$VSIX_FILE"

if command -v code &> /dev/null; then
    code --install-extension "$FULL_VSIX_PATH" --force
    echo "✅ 成功安装到 VS Code！"
# elif command -v agy &> /dev/null; then
#     agy --install-extension "$FULL_VSIX_PATH" --force
#     echo "✅ 成功安装到 agy"
else
    echo "❌ 错误: 未找到 'code' 或 'cursor' 命令。"
    echo "请手动安装: $FULL_VSIX_PATH"
    exit 1
fi

echo ""
echo "✨ 全部完成！请在 VS Code 中运行 'Developer: Reload Window' 以应用更新。"