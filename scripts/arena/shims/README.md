Plain-PyTorch stand-ins for the GPU-only packages that YingLong's model code imports (flash_attn, xformers,
dropout_layer_norm, rotary_emb), so it runs on CPU. predict.py adds this folder to the import path for the
yinglong adapter only. Each one does the same arithmetic as the real kernel for inference (no dropout, no backward).
