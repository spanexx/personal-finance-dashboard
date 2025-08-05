import { Component, OnInit, AfterViewInit, ElementRef, ViewChild, OnDestroy } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormBuilder, FormGroup, Validators, ReactiveFormsModule } from '@angular/forms';
import { Router } from '@angular/router';
import { Subject, takeUntil, finalize } from 'rxjs';

// Angular Material imports
import { MatCardModule } from '@angular/material/card';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { MatSelectModule } from '@angular/material/select';
import { MatDatepickerModule } from '@angular/material/datepicker';
import { MatNativeDateModule } from '@angular/material/core';
import { MatSnackBarModule, MatSnackBar } from '@angular/material/snack-bar';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { MatDividerModule } from '@angular/material/divider';
import { MatChipsModule } from '@angular/material/chips';
import { MatBadgeModule } from '@angular/material/badge';
import { MatTooltipModule } from '@angular/material/tooltip';
import { MatProgressBarModule } from '@angular/material/progress-bar';
import { MatDialogModule, MatDialog } from '@angular/material/dialog';

// Services
import { AccessibilityService } from '../../../shared/services/accessibility.service';
import { UserProfileService } from '../../../core/services/user-profile.service';
import { FileService } from '../../../core/services/file.service';

// Models
import { UserProfile } from '../../../shared/models';

// Directives
import { FocusTrapDirective } from '../../../shared/directives/focus-trap.directive';

@Component({
  selector: 'app-profile-settings',
  standalone: true,
  imports: [
    CommonModule,
    ReactiveFormsModule,
    MatCardModule,
    MatButtonModule,
    MatIconModule,
    MatFormFieldModule,
    MatInputModule,
    MatSelectModule,
    MatDatepickerModule,
    MatNativeDateModule,
    MatSnackBarModule,
    MatProgressSpinnerModule,
    MatDividerModule,
    MatChipsModule,
    MatBadgeModule,
    MatTooltipModule,
    MatProgressBarModule,
    MatDialogModule,
    FocusTrapDirective
  ],
  templateUrl: './profile-settings.component.html',
  styleUrls: ['./profile-settings.component.scss']
})
export class ProfileSettingsComponent implements OnInit, AfterViewInit, OnDestroy {
  @ViewChild('pageTitle') pageTitle!: ElementRef;
  @ViewChild('firstInput') firstInput!: ElementRef;
  @ViewChild('fileInput') fileInput!: ElementRef;

  profileForm!: FormGroup;
  currentProfile: UserProfile | null = null;
  isLoading = false;
  isSaving = false;
  isUploadingImage = false;
  hasUnsavedChanges = false;
  selectedImageFile: File | null = null;
  imagePreviewUrl: string | null = null;
  fetchedProfileImage: string | null = null;

  private destroy$ = new Subject<void>();

  constructor(
    private fb: FormBuilder,
    private router: Router,
    private accessibilityService: AccessibilityService,
    private userProfileService: UserProfileService,
    private fileService: FileService,
    private snackBar: MatSnackBar,
    private dialog: MatDialog
  ) {
    this.initializeForm();
  }
  ngOnInit(): void {
    this.loadProfileData();
    this.trackFormChanges();
    this.subscribeToProfileUpdates();
  }

  ngAfterViewInit(): void {
    // Set focus on page title for screen readers
    setTimeout(() => {
      if (this.pageTitle?.nativeElement) {
        this.pageTitle.nativeElement.focus();
      }
    }, 100);
    
    // Announce page load
    this.accessibilityService.announce('Profile settings page loaded');
  }

  ngOnDestroy(): void {
    this.destroy$.next();
    this.destroy$.complete();
  }
  private initializeForm(): void {
    this.profileForm = this.fb.group({
      firstName: ['', [Validators.required, Validators.minLength(2), Validators.maxLength(50)]],
      lastName: ['', [Validators.required, Validators.minLength(2), Validators.maxLength(50)]],
      email: ['', [Validators.required, Validators.email]],
      username: ['', [Validators.minLength(3), Validators.maxLength(20)]],
      phone: [''],
      dateOfBirth: [''],
      bio: ['', [Validators.maxLength(500)]],
      address: this.fb.group({
        street: [''],
        city: [''],
        state: [''],
        zipCode: [''],
        country: ['']
      })
    });
  }

  private loadProfileData(): void {
    this.isLoading = true;
    this.userProfileService.getProfile()
      .pipe(
        takeUntil(this.destroy$),
        finalize(() => this.isLoading = false)
      )
      .subscribe({
        next: (profile) => {
          console.log('Loaded profile:', profile);
          const user = (typeof profile === 'object' && 'user' in profile) ? (profile as any).user : profile;
          this.currentProfile = user;
          this.populateForm(user);
          // Use profileImage directly from user object
          this.fetchedProfileImage = user.profileImage || null;
          console.log('Fetched profile image:', this.fetchedProfileImage);
        },
        error: (error) => {
          console.error('Error loading profile:', error);
          this.showError('Failed to load profile data');
        }
      });
  }
  private populateForm(profile: UserProfile): void {
    this.profileForm.patchValue({
      firstName: profile.firstName,
      lastName: profile.lastName,
      email: profile.email,
      username: profile.username,
      phone: profile.phone || '',
      dateOfBirth: profile.dateOfBirth ? new Date(profile.dateOfBirth) : null,
      bio: profile.bio || '',
      address: {
        street: profile.address?.street || '',
        city: profile.address?.city || '',
        state: profile.address?.state || '',
        zipCode: profile.address?.zipCode || '',
        country: profile.address?.country || ''
      }
    });
    this.profileForm.markAsPristine();
  }

  private subscribeToProfileUpdates(): void {
    this.userProfileService.profile$
      .pipe(takeUntil(this.destroy$))
      .subscribe(profile => {
        if (profile) {
          this.currentProfile = profile;
        }
      });
  }

  private trackFormChanges(): void {
    this.profileForm.valueChanges
      .pipe(takeUntil(this.destroy$))
      .subscribe(() => {
        this.hasUnsavedChanges = this.profileForm.dirty;
      });
  }

  // Profile Image Methods
  onFileSelected(event: Event): void {
    const input = event.target as HTMLInputElement;
    if (input.files && input.files[0]) {
      const file = input.files[0];
      // TODO: Add file validation if needed
      this.selectedImageFile = file;
      // Create preview
      const reader = new FileReader();
      reader.onload = (e) => {
        this.imagePreviewUrl = e.target?.result as string;
      };
      reader.readAsDataURL(file);
    }
  }

  uploadProfileImage(): void {
    if (!this.selectedImageFile) return;
    this.isUploadingImage = true;
    // Use FileService to upload avatar
    this.fileService.uploadAvatar(this.selectedImageFile)
      .pipe(
        takeUntil(this.destroy$),
        finalize(() => {
          this.isUploadingImage = false;
          this.selectedImageFile = null;
          this.imagePreviewUrl = null;
          if (this.fileInput) {
            this.fileInput.nativeElement.value = '';
          }
        })
      )
      .subscribe({
        next: (res) => {
          if (res.success && res.data && res.data.url) {
            this.fetchedProfileImage = res.data.url;
            this.showSuccess('Profile image updated successfully');
            this.accessibilityService.announce('Profile image updated');
          } else {
            this.showError('Failed to update profile image');
          }
        },
        error: (error) => {
          console.error('Error uploading image:', error);
          this.showError('Failed to upload profile image');
        }
      });
  }

  deleteProfileImage(): void {
    if (!this.currentProfile?.profileImage) return;
    if (confirm('Are you sure you want to delete your profile image?')) {
      // Use FileService to get current avatar and delete
      this.fileService.getUserAvatar().subscribe({
        next: (res) => {
          if (res.success && res.data && (res.data.id || res.data._id)) {
            const fileId = res.data.id || res.data._id;
            this.fileService.deleteFile(fileId).subscribe({
              next: () => {
                this.fetchedProfileImage = null;
                this.showSuccess('Profile image deleted successfully');
                this.accessibilityService.announce('Profile image deleted');
              },
              error: (error) => {
                console.error('Error deleting image:', error);
                this.showError('Failed to delete profile image');
              }
            });
          } else {
            this.showError('No avatar found to delete');
          }
        },
        error: (error) => {
          console.error('Error fetching avatar:', error);
          this.showError('Failed to fetch avatar');
        }
      });
    }
  }

  cancelImageUpload(): void {
    this.selectedImageFile = null;
    this.imagePreviewUrl = null;
    if (this.fileInput) {
      this.fileInput.nativeElement.value = '';
    }
  }

  // Form Submission
  onSubmit(): void {
    if (this.profileForm.valid && this.profileForm.dirty) {
      this.saveProfile();
    }
  }

  private saveProfile(): void {
    this.isSaving = true;
    const formData = this.profileForm.value;
    
    this.userProfileService.updateProfile(formData)
      .pipe(
        takeUntil(this.destroy$),
        finalize(() => this.isSaving = false)
      )
      .subscribe({
        next: (profile) => {
          this.profileForm.markAsPristine();
          this.hasUnsavedChanges = false;
          this.showSuccess('Profile updated successfully');
          this.accessibilityService.announce('Profile saved successfully');
        },
        error: (error) => {
          console.error('Error saving profile:', error);
          this.showError('Failed to update profile');
        }
      });
  }

  // Email Verification
  resendEmailVerification(): void {
    this.userProfileService.resendEmailVerification()
      .pipe(takeUntil(this.destroy$))
      .subscribe({
        next: () => {
          this.showSuccess('Verification email sent successfully');
          this.accessibilityService.announce('Verification email sent');
        },
        error: (error) => {
          console.error('Error sending verification email:', error);
          this.showError('Failed to send verification email');
        }
      });
  }

  // Utility Methods
  getProfileImageUrl(): string {
    // Use preview if available
    if (this.imagePreviewUrl) {
      return this.imagePreviewUrl;
    }
    // If fetchedProfileImage is a direct URL (e.g., S3 or cloud), use it
    if (this.fetchedProfileImage && this.fetchedProfileImage.startsWith('http')) {
      return this.fetchedProfileImage;
    }
    // If fetchedProfileImage is a file id, use the backend API endpoint
    if (this.fetchedProfileImage && this.fetchedProfileImage.length < 100 && !this.fetchedProfileImage.includes('/')) {
      // Assume it's a MongoDB ObjectId or short string
      return `http://localhost:5000/api/uploads/${this.fetchedProfileImage}`;
    }
    // Fallback to default
    return '/assets/images/default-avatar.png';
  }

  getProfileCompletionText(): string {
    if (!this.currentProfile || !this.currentProfile.profileCompleteness || typeof this.currentProfile.profileCompleteness.percentage !== 'number') {
      return 'Profile completion data unavailable';
    }
    const percentage = this.currentProfile.profileCompleteness.percentage;
    return `${percentage}% complete`;
  }

  getMemberSince(): string {
    if (!this.currentProfile) return '';
    return new Date(this.currentProfile.createdAt).toLocaleDateString();
  }

  getLastLogin(): string {
    if (!this.currentProfile) return '';
    return new Date(this.currentProfile.lastLoginAt).toLocaleString();
  }

  private showSuccess(message: string): void {
    this.snackBar.open(message, 'Close', {
      duration: 5000,
      panelClass: ['success-snackbar']
    });
  }
  private showError(message: string): void {
    this.snackBar.open(message, 'Close', {
      duration: 7000,
      panelClass: ['error-snackbar']
    });
  }

  // Navigation and Form Management
  onCancel(): void {
    if (this.hasUnsavedChanges) {
      const confirmDiscard = confirm('You have unsaved changes. Are you sure you want to discard them?');
      if (confirmDiscard) {
        this.profileForm.reset();
        this.loadProfileData();
        this.accessibilityService.announce('Changes discarded');
      }
    }
  }

  onBack(): void {
    if (this.hasUnsavedChanges) {
      const confirmLeave = confirm('You have unsaved changes. Are you sure you want to leave?');
      if (confirmLeave) {
        this.router.navigate(['/settings']);
      }
    } else {
      this.router.navigate(['/settings']);
    }
  }

  onKeyDown(event: KeyboardEvent): void {
    // Handle keyboard navigation
    if (event.key === 'Escape') {
      this.onBack();
    } else if (event.ctrlKey && event.key === 's') {
      event.preventDefault();
      if (this.profileForm.valid && !this.isSaving) {
        this.onSubmit();
      }
    }
  }

  // Form Validation Helpers
  private focusFirstInvalidField(): void {
    const firstInvalidControl = Object.keys(this.profileForm.controls)
      .find(key => this.profileForm.get(key)?.invalid);

    if (firstInvalidControl) {
      const element = document.querySelector(`[formControlName="${firstInvalidControl}"]`) as HTMLElement;
      if (element) {
        element.focus();
      }
    }
  }

  getFieldError(fieldName: string): string {
    const field = this.profileForm.get(fieldName);
    if (field?.errors && field.touched) {
      if (field.errors['required']) return `${fieldName} is required`;
      if (field.errors['email']) return 'Please enter a valid email address';
      if (field.errors['minlength']) return `${fieldName} must be at least ${field.errors['minlength'].requiredLength} characters`;
      if (field.errors['pattern']) return `Please enter a valid ${fieldName}`;
      if (field.errors['maxlength']) return `${fieldName} cannot exceed ${field.errors['maxlength'].requiredLength} characters`;
    }
    return '';
  }

  isFieldInvalid(fieldName: string): boolean {
    const field = this.profileForm.get(fieldName);
    return !!(field?.invalid && field.touched);
  }
  onImageError(event: Event): void {
    const target = event.target as HTMLImageElement;
    if (target) {
      target.src = '/assets/images/default-avatar.png';
    }
  }
}
