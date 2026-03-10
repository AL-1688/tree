# Whisper 模型本地部署指南

本指南说明如何手动下载并部署 Whisper 模型文件，以避免网络访问问题。

## 重要说明

**推荐方案：使用浏览器自动缓存**

Transformers.js 会自动将下载的模型缓存到浏览器的 IndexedDB 中。首次加载后，模型会被缓存，后续使用无需重新下载。

如果您的网络可以访问 Hugging Face（建议使用 VPN），直接在应用中加载模型即可自动缓存。

**备选方案：手动部署本地模型**

如果网络无法访问 Hugging Face，可以手动下载模型文件到 `public/models/` 目录。

## 模型文件结构

模型文件应放置在 `public/models/Xenova/whisper-{model}/` 目录下，例如：

```
public/models/Xenova/whisper-tiny/
├── config.json
├── preprocessor_config.json
├── tokenizer.json
├── tokenizer_config.json
├── onnx/
│   ├── model.onnx          (~150MB)
│   └── model_quantized.onnx (~40MB, 推荐)
```

## 下载方法

### 方法一：使用 huggingface-cli（推荐）

```bash
# 安装 huggingface-hub
pip install huggingface-hub

# 设置镜像（中国用户）
export HF_ENDPOINT=https://hf-mirror.com

# 下载模型
huggingface-cli download Xenova/whisper-tiny \
  --local-dir public/models/Xenova/whisper-tiny \
  --local-dir-use-symlinks False
```

### 方法二：使用 wget 批量下载

创建下载脚本 `download-model.sh`：

```bash
#!/bin/bash
MODEL_NAME="whisper-tiny"
BASE_URL="https://hf-mirror.com/Xenova/${MODEL_NAME}/resolve/main"
TARGET_DIR="public/models/Xenova/${MODEL_NAME}"

mkdir -p "${TARGET_DIR}/onnx"

# 下载配置文件
for file in config.json preprocessor_config.json tokenizer.json tokenizer_config.json; do
  echo "Downloading ${file}..."
  wget -O "${TARGET_DIR}/${file}" "${BASE_URL}/${file}"
done

# 下载 ONNX 模型文件
echo "Downloading ONNX model files (this may take a while)..."
wget -O "${TARGET_DIR}/onnx/model_quantized.onnx" "${BASE_URL}/onnx/model_quantized.onnx"
wget -O "${TARGET_DIR}/onnx/model.onnx" "${BASE_URL}/onnx/model.onnx"

echo "Download complete!"
```

### 方法三：手动下载

1. 访问模型页面：
   - 镜像：https://hf-mirror.com/Xenova/whisper-tiny/tree/main
   - 官方：https://huggingface.co/Xenova/whisper-tiny/tree/main

2. 下载以下文件到 `public/models/Xenova/whisper-tiny/` 目录：
   - `config.json`
   - `preprocessor_config.json`
   - `tokenizer.json`
   - `tokenizer_config.json`
   - `onnx/model.onnx` (约 150MB)
   - `onnx/model_quantized.onnx` (约 40MB，推荐使用)

## 可用模型大小

| 模型 | 参数量 | 内存占用 | 识别质量 | 下载大小 |
|------|--------|----------|----------|----------|
| tiny | 39M | ~150MB | 一般 | ~150MB |
| base | 74M | ~250MB | 较好 | ~250MB |
| small | 244M | ~600MB | 好 | ~500MB |
| medium | 769M | ~1.5GB | 很好 | ~1.5GB |

推荐先使用 `tiny` 模型进行测试。

## 验证模型文件

下载完成后，目录结构应为：

```bash
ls -la public/models/Xenova/whisper-tiny/
# 应显示：
# config.json
# preprocessor_config.json
# tokenizer.json
# tokenizer_config.json
# onnx/
#   model.onnx (~150MB)
#   model_quantized.onnx (~40MB)
```

## 故障排除

1. **模型加载失败**：检查文件完整性，确保 ONNX 文件下载完整
2. **内存不足**：尝试使用更小的模型或量化版本 (model_quantized.onnx)
3. **跨域问题**：确保模型文件在 `public` 目录下，通过相对路径访问
4. **网络超时**：建议使用断点续传工具（如 `wget -c`）或代理

## 注意事项

- `model_quantized.onnx` 是量化版本，体积更小但精度略低，推荐优先使用
- 如果同时存在 `model.onnx` 和 `model_quantized.onnx`，Transformers.js 会优先使用量化版本
- 模型文件较大，建议使用断点续传工具下载
