from typing import List

def fft_tile_fix(path: str) -> str:
    """
    Placeholder for an FFT-based tile seam fixer.
    Return the same path for now.
    """
    return path

def derive_normal_roughness_ao(albedo_path: str) -> List[str]:
    """
    Placeholder normal/roughness/AO derivation.
    Returns the input path three times to keep flow unblocked.
    """
    return [albedo_path, albedo_path, albedo_path]
