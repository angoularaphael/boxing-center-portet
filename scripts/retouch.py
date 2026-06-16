import os
import cv2
import numpy as np
from PIL import Image

try:
    from rembg import remove
    REMBG_AVAILABLE = True
except ImportError:
    REMBG_AVAILABLE = False
    print("Warning: rembg is not available, will try to use existing cutouts if possible.")

def shift_red_to_navy(img):
    """
    Finds red/orange/brown colors in the image and shifts them to deep navy (#182848)
    while keeping the textures, shadows, and highlights.
    """
    hsv = cv2.cvtColor(img, cv2.COLOR_BGR2HSV)
    
    # Red hue ranges (0-12 and 160-180 in OpenCV HSV)
    lower_red1 = np.array([0, 30, 20])
    upper_red1 = np.array([12, 255, 255])
    lower_red2 = np.array([160, 30, 20])
    upper_red2 = np.array([180, 255, 255])
    
    # Warm/brown colors (often found in wooden ceilings, structures, or warm gym lighting)
    lower_warm = np.array([12, 30, 20])
    upper_warm = np.array([25, 255, 200])
    
    mask1 = cv2.inRange(hsv, lower_red1, upper_red1)
    mask2 = cv2.inRange(hsv, lower_red2, upper_red2)
    mask3 = cv2.inRange(hsv, lower_warm, upper_warm)
    
    full_mask = mask1 | mask2 | mask3
    
    # Blur the mask to ensure smooth transitions and avoid pixelation
    mask_blurred = cv2.GaussianBlur(full_mask, (15, 15), 0)
    mask_f = mask_blurred.astype(float) / 255.0
    mask_f = np.expand_dims(mask_f, axis=2)
    
    # Create navy target BGR image
    # Navy: #182848 (B=72, G=40, R=24)
    # HSV: Hue = 110, Saturation = 150-180, Value = original * scale (darker for moody feel)
    hsv_navy = hsv.copy()
    hsv_navy[:, :, 0] = 110 # Navy Blue Hue
    hsv_navy[:, :, 1] = np.clip(hsv[:, :, 1] * 0.95, 120, 190).astype(np.uint8) # Saturation
    hsv_navy[:, :, 2] = np.clip(hsv[:, :, 2] * 0.55, 15, 80).astype(np.uint8) # Dark, moody value
    
    navy_bgr = cv2.cvtColor(hsv_navy, cv2.COLOR_HSV2BGR)
    
    # Blend original and navy BGR based on the warm/red mask
    recolored = (img * (1.0 - mask_f) + navy_bgr * mask_f).astype(np.uint8)
    return recolored

def apply_vignette(img):
    """
    Applies a smooth, cinematic radial vignette to the image.
    """
    h, w = img.shape[:2]
    # Create radial gradient
    a = cv2.getGaussianKernel(w, w/2.2)
    b = cv2.getGaussianKernel(h, h/2.2)
    c = b * a.T
    d = c / c.max()
    
    # Scale vignette effect: 0.65 (corners) to 1.0 (center)
    mask = 0.65 + 0.35 * d
    mask = np.expand_dims(mask, axis=2)
    
    # Blend with image
    vignetted = (img * mask).astype(np.uint8)
    return vignetted

def upscale_image(pil_img, target_long_edge=2048):
    """
    Resizes image using PIL Lanczos interpolation so its long edge matches target_long_edge.
    """
    w, h = pil_img.size
    if w >= h:
        new_w = target_long_edge
        new_h = int(h * (target_long_edge / w))
    else:
        new_h = target_long_edge
        new_w = int(w * (target_long_edge / h))
    return pil_img.resize((new_w, new_h), Image.Resampling.LANCZOS)

def process_coaches(coaches_dir, gym_dir):
    """
    Processes the coaches portraits. Extracts subjects, recolors backgrounds,
    composites them, and saves the upscaled PNG cutouts and WebP scenes.
    """
    out_dir = os.path.join(coaches_dir, "out")
    os.makedirs(out_dir, exist_ok=True)
    
    # Choose coherent backgrounds
    bg_landscape_path = os.path.join(gym_dir, "gym-06.jpg")
    bg_portrait_path = os.path.join(gym_dir, "gym-15.jpg")
    
    bg_landscape = cv2.imread(bg_landscape_path)
    bg_portrait = cv2.imread(bg_portrait_path)
    
    # Pre-recolor the backgrounds to navy/silver and keep them ready
    if bg_landscape is not None:
        bg_landscape = shift_red_to_navy(bg_landscape)
    if bg_portrait is not None:
        bg_portrait = shift_red_to_navy(bg_portrait)
        
    for file in os.listdir(coaches_dir):
        if not file.lower().endswith(('.webp', '.jpg', '.png', '.jpeg')):
            continue
        if file.startswith("coach-brice-rembg-test"):
            continue # skip test file
            
        p = os.path.join(coaches_dir, file)
        print(f"Processing Portrait: {file}...")
        
        # Load and upscale original image
        pil_img = Image.open(p)
        pil_img = upscale_image(pil_img, 2048)
        w, h = pil_img.size
        
        # 1. Get transparent cutout using rembg
        if REMBG_AVAILABLE:
            cutout_pil = remove(
                pil_img,
                alpha_matting=True,
                alpha_matting_foreground_threshold=240,
                alpha_matting_background_threshold=10
            )
        else:
            # Fallback to existing cutout from cutouts/ folder if available
            cutout_name = os.path.splitext(file)[0] + ".png"
            cutout_fallback = os.path.join(coaches_dir, "cutouts", cutout_name)
            if os.path.exists(cutout_fallback):
                print(f"  Using fallback cutout: {cutout_fallback}")
                cutout_pil = Image.open(cutout_fallback)
                cutout_pil = upscale_image(cutout_pil, 2048)
            else:
                print(f"  Error: rembg not available and fallback cutout {cutout_fallback} not found.")
                continue
                
        # Save transparent cutout as PNG in the out/ folder
        base_name = os.path.splitext(file)[0]
        cutout_png_path = os.path.join(out_dir, f"{base_name}.png")
        cutout_pil.save(cutout_png_path, "PNG")
        print(f"  Saved cutout: {cutout_png_path}")
        
        # Convert PIL to CV2 BGR/BGRA
        cutout_np = np.array(cutout_pil)
        if cutout_np.shape[2] == 4:
            cutout_bgr = cutout_np[:, :, :3]
            # Convert RGB to BGR
            cutout_bgr = cv2.cvtColor(cutout_bgr, cv2.COLOR_RGB2BGR)
            alpha = cutout_np[:, :, 3]
        else:
            cutout_bgr = cv2.cvtColor(cutout_np, cv2.COLOR_RGB2BGR)
            alpha = np.ones((h, w), dtype=np.uint8) * 255
            
        # 2. Prepare background scene
        is_landscape = w >= h
        bg_template = bg_landscape if is_landscape else bg_portrait
        if bg_template is None:
            # Fallback: create a solid navy background if reference gym photos are missing
            bg_scene = np.zeros((h, w, 3), dtype=np.uint8)
            bg_scene[:, :] = [72, 40, 24] # Navy BGR
        else:
            # Crop/resize background template to match target size exactly
            bg_h, bg_w = bg_template.shape[:2]
            scale_x = w / bg_w
            scale_y = h / bg_h
            scale = max(scale_x, scale_y)
            resized_bg = cv2.resize(bg_template, (int(bg_w * scale), int(bg_h * scale)), interpolation=cv2.INTER_LANCZOS4)
            # Center crop
            rx, ry = (resized_bg.shape[1] - w) // 2, (resized_bg.shape[0] - h) // 2
            bg_scene = resized_bg[ry:ry+h, rx:rx+w].copy()
            
        # Apply depth-of-field Gaussian Blur to background
        bg_scene = cv2.GaussianBlur(bg_scene, (17, 17), 0)
        
        # 3. Composite subject onto the background
        alpha_f = alpha.astype(float) / 255.0
        alpha_f = np.expand_dims(alpha_f, axis=2)
        
        composite = (cutout_bgr * alpha_f + bg_scene * (1.0 - alpha_f)).astype(np.uint8)
        
        # 4. Cinematic grade: vignette + slight contrast boost
        composite = apply_vignette(composite)
        # Subtle contrast/brightness adjustment
        composite = cv2.convertScaleAbs(composite, alpha=1.05, beta=2)
        
        # Save composite WebP
        scene_webp_path = os.path.join(out_dir, f"{base_name}.webp")
        # Save using PIL to output webp with high quality
        composite_rgb = cv2.cvtColor(composite, cv2.COLOR_BGR2RGB)
        pil_composite = Image.fromarray(composite_rgb)
        pil_composite.save(scene_webp_path, "WEBP", quality=92)
        print(f"  Saved scene: {scene_webp_path}")

def process_disc(disc_dir):
    """
    Processes the disciplines action photos. Shift red assets in background to navy,
    protecting subjects using rembg cutout masks.
    """
    out_dir = os.path.join(disc_dir, "out")
    os.makedirs(out_dir, exist_ok=True)
    
    for file in os.listdir(disc_dir):
        if not file.lower().endswith(('.webp', '.jpg', '.png', '.jpeg')):
            continue
            
        p = os.path.join(disc_dir, file)
        print(f"Processing Discipline Action Shot: {file}...")
        
        # Load and upscale original image
        pil_img = Image.open(p)
        pil_img = upscale_image(pil_img, 2048)
        w, h = pil_img.size
        
        # Convert to BGR
        orig_bgr = cv2.cvtColor(np.array(pil_img), cv2.COLOR_RGB2BGR)
        
        # 1. Extract subject mask using rembg
        if REMBG_AVAILABLE:
            cutout_pil = remove(
                pil_img,
                alpha_matting=True,
                alpha_matting_foreground_threshold=240,
                alpha_matting_background_threshold=10
            )
            cutout_np = np.array(cutout_pil)
            if cutout_np.shape[2] == 4:
                alpha = cutout_np[:, :, 3]
            else:
                alpha = np.zeros((h, w), dtype=np.uint8)
        else:
            alpha = np.zeros((h, w), dtype=np.uint8)
            
        # 2. Recolor red elements in the image to navy
        recolored_bgr = shift_red_to_navy(orig_bgr)
        
        # 3. Composite original people back on top using mask (protects skin/clothing)
        alpha_f = alpha.astype(float) / 255.0
        alpha_f = np.expand_dims(alpha_f, axis=2)
        
        # Blend: recolored background + original subject
        final_bgr = (orig_bgr * alpha_f + recolored_bgr * (1.0 - alpha_f)).astype(np.uint8)
        
        # 4. Cinematic grade: subtle vignette
        final_bgr = apply_vignette(final_bgr)
        
        # Save final WebP
        base_name = os.path.splitext(file)[0]
        out_webp_path = os.path.join(out_dir, f"{base_name}.webp")
        final_rgb = cv2.cvtColor(final_bgr, cv2.COLOR_BGR2RGB)
        pil_final = Image.fromarray(final_rgb)
        pil_final.save(out_webp_path, "WEBP", quality=92)
        print(f"  Saved action scene: {out_webp_path}")

if __name__ == "__main__":
    coaches_dir = r"c:\Users\Mommy Jayce\Desktop\Boxing Center\Portet\boxing-center-portet\public\img\coaches"
    disc_dir = r"c:\Users\Mommy Jayce\Desktop\Boxing Center\Portet\boxing-center-portet\public\img\disc"
    gym_dir = r"c:\Users\Mommy Jayce\Desktop\Boxing Center\Portet\boxing-center-portet\public\img"
    
    print("--- STARTING PORTRAITS RETOUCHING ---")
    process_coaches(coaches_dir, gym_dir)
    print("\n--- STARTING DISCIPLINES RETOUCHING ---")
    process_disc(disc_dir)
    print("\n--- IMAGE RETOUCHING COMPLETED SUCCESSFULY ---")
